from pydantic import BaseModel, Field, ConfigDict
from datetime import date
from typing import Optional, List
from enum import Enum

class ActivityType(str, Enum):
    Rally = "Rally"
    Media = "Media"
    Project = "Project"

class ElectorateBase(BaseModel):
    name: str
    province: str
    type: str

class ElectorateCreate(ElectorateBase):
    pass

class Electorate(ElectorateBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class CampaignActivityBase(BaseModel):
    activity_type: ActivityType
    date: date
    location: str
    sentiment_score: float = Field(..., ge=-1.0, le=1.0)

class CampaignActivityCreate(CampaignActivityBase):
    candidate_id: int

class CampaignActivity(CampaignActivityBase):
    id: int
    candidate_id: int
    model_config = ConfigDict(from_attributes=True)

class ElectionHistoryBase(BaseModel):
    year: int
    votes_received: int
    result_status: str

class ElectionHistoryCreate(ElectionHistoryBase):
    candidate_id: int

class ElectionHistory(ElectionHistoryBase):
    id: int
    candidate_id: int
    model_config = ConfigDict(from_attributes=True)

class CandidateBase(BaseModel):
    name: str
    electorate_id: int
    party_id: Optional[int] = None
    incumbent_status: bool = False

class CandidateCreate(CandidateBase):
    pass

class Candidate(CandidateBase):
    id: int
    campaign_activities: List[CampaignActivity] = []
    election_history: List[ElectionHistory] = []
    model_config = ConfigDict(from_attributes=True)

class CandidateIntelligence(Candidate):
    electorate_name: Optional[str] = None
