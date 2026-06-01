// packages/core/schemas/codegen.ts
import * as fs from "node:fs";
import * as path from "node:path";

interface SchemaDef {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  enum?: string[];
  items?: any;
  description?: string;
}

interface Schema {
  $defs: Record<string, SchemaDef>;
}

function generateTypeScript(defs: Record<string, SchemaDef>): string {
  const lines: string[] = [
    "// Auto-generated from source-of-truth.json — DO NOT EDIT",
    "// Run: pnpm codegen",
    "",
  ];

  for (const [name, def] of Object.entries(defs)) {
    if (def.enum) {
      lines.push(`export type ${name} = ${def.enum.map((e) => `'${e}'`).join(" | ")};`);
      lines.push("");
      continue;
    }
    if (!def.properties) continue;

    lines.push(`export interface ${name} {`);
    for (const [prop, propDef] of Object.entries(def.properties)) {
      const optional = !def.required?.includes(prop) ? "?" : "";
      const tsType = jsonTypeToTS(propDef, defs);
      const desc = propDef.description ? `  /** ${propDef.description} */` : "";
      if (desc) lines.push(desc);
      lines.push(`  ${prop}${optional}: ${tsType};`);
    }
    lines.push(`}`);
    lines.push("");
  }

  return lines.join("\n");
}

function jsonTypeToTS(def: any, allDefs: Record<string, SchemaDef>): string {
  if (def.$ref) return def.$ref.replace("#/$defs/", "");
  switch (def.type) {
    case "string": return "string";
    case "number": return "number";
    case "boolean": return "boolean";
    case "array": return `${jsonTypeToTS(def.items, allDefs)}[]`;
    case "object":
      if (def.properties) {
        const props = Object.entries(def.properties)
          .map(([k, v]: [string, any]) => `${k}: ${jsonTypeToTS(v, allDefs)}`)
          .join("; ");
        return `{ ${props} }`;
      }
      return "Record<string, unknown>";
    default:
      if (def.enum) return def.enum.map((e: string) => `'${e}'`).join(" | ");
      return "unknown";
  }
}

function generatePydantic(defs: Record<string, SchemaDef>): string {
  const lines: string[] = [
    "# Auto-generated from source-of-truth.json — DO NOT EDIT",
    "# Run: pnpm codegen",
    "",
    "from pydantic import BaseModel",
    "from typing import Optional, Literal",
    "",
    "",
  ];

  const sorted = topologicalSort(defs);

  for (const name of sorted) {
    const def = defs[name];
    if (!def) continue;
    if (def.enum) {
      const literalUnion = def.enum.map((e) => `'${e}'`).join(", ");
      lines.push(`# Type alias: ${name} = Literal[${literalUnion}]`);
      lines.push("");
      continue;
    }
    if (!def.properties) continue;

    lines.push(`class ${name}(BaseModel):`);
    for (const [prop, propDef] of Object.entries(def.properties)) {
      const pyType = jsonTypeToPy(propDef, defs);
      const optional = !def.required?.includes(prop);
      const defaultVal = optional ? " = None" : "";
      const desc = propDef.description ? `  # ${propDef.description}` : "";
      lines.push(`    ${prop}: ${pyType}${defaultVal}${desc}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function jsonTypeToPy(def: any, allDefs: Record<string, SchemaDef>): string {
  if (def.$ref) return def.$ref.replace("#/$defs/", "");
  switch (def.type) {
    case "string": return "str";
    case "number": return "float";
    case "boolean": return "bool";
    case "array": return `list[${jsonTypeToPy(def.items, allDefs)}]`;
    case "object":
      if (def.properties) {
        const props = Object.entries(def.properties)
          .map(([k, v]: [string, any]) => `${k}: ${jsonTypeToPy(v, allDefs)}`)
          .join(", ");
        return `dict[str, ${props}]`;
      }
      return "dict";
    default:
      if (def.enum) return `Literal[${def.enum.map((e: string) => `'${e}'`).join(", ")}]`;
      return "Any";
  }
}

function topologicalSort(defs: Record<string, SchemaDef>): string[] {
  const sorted: string[] = [];
  const visited = new Set<string>();

  function visit(name: string) {
    if (visited.has(name)) return;
    visited.add(name);
    const def = defs[name];
    if (def?.properties) {
      for (const propDef of Object.values(def.properties)) {
        if ((propDef as any).$ref) visit((propDef as any).$ref.replace("#/$defs/", ""));
        if ((propDef as any).items?.$ref) visit((propDef as any).items.$ref.replace("#/$defs/", ""));
      }
    }
    sorted.push(name);
  }

  for (const name of Object.keys(defs)) visit(name);
  return sorted;
}

// ─── Main ───
const schemaPath = path.resolve(__dirname, "source-of-truth.json");
const tsOutputPath = path.resolve(__dirname, "generated/types.ts");
const pyOutputPath = path.resolve(__dirname, "../../../services/fastapi/app/schemas/models.py");

const schema: Schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));

fs.mkdirSync(path.dirname(tsOutputPath), { recursive: true });
fs.mkdirSync(path.dirname(pyOutputPath), { recursive: true });
fs.writeFileSync(tsOutputPath, generateTypeScript(schema.$defs), "utf-8");
fs.writeFileSync(pyOutputPath, generatePydantic(schema.$defs), "utf-8");

console.log(`✅ Codegen complete:
  TS: ${tsOutputPath}
  PY: ${pyOutputPath}`);
