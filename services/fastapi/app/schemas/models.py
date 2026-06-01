# Auto-generated from source-of-truth.json — DO NOT EDIT
# Run: pnpm codegen

from pydantic import BaseModel
from typing import Optional, Literal


class KeywordItem(BaseModel):
    word: str  # 关键词
    weight: float  # 权重 0-1
    category: str  # 分类

class MatchProfile(BaseModel):
    score: float  # 综合匹配分数 0-1
    gaps: list[str]  # 缺失项列表

class JDParsed(BaseModel):
    keywords: list[KeywordItem]
    techStack: list[str]
    roleType: str
    matchProfile: MatchProfile

class FlashCardData(BaseModel):
    id: str
    question: str
    answer: str
    codeSnippet: str = None
    language: str = None

class ProjectCard(BaseModel):
    id: str
    title: str
    description: str
    techStack: list[str]
    jdMatchScore: float
    architecture: str  # Mermaid DSL
    challenges: list[FlashCardData]

class AlignmentQuestion(BaseModel):
    id: str
    text: str
    options: list[dict[str, id: str, text: str]]

class STARBullet(BaseModel):
    id: str
    situation: str
    task: str
    action: str
    result: str
