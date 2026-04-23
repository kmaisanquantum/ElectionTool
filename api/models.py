from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Float, Date, Enum as SQLEnum
from sqlalchemy.orm import relationship
import enum
from api.database import Base

class ActivityType(enum.Enum):
    Rally = "Rally"
    Media = "Media"
    Project = "Project"

class Electorate(Base):
    __tablename__ = "electorates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    province = Column(String, nullable=False)
    type = Column(String, nullable=False)

    candidates = relationship("Candidate", back_populates="electorate")

class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(Integer, primary_key=True, index=True)
    electorate_id = Column(Integer, ForeignKey("electorates.id"), nullable=False)
    party_id = Column(Integer, nullable=True)
    name = Column(String, nullable=False)
    incumbent_status = Column(Boolean, default=False)

    electorate = relationship("Electorate", back_populates="candidates")
    campaign_activities = relationship("CampaignActivity", back_populates="candidate")
    election_history = relationship("ElectionHistory", back_populates="candidate")

class CampaignActivity(Base):
    __tablename__ = "campaign_activities"

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=False)
    activity_type = Column(SQLEnum(ActivityType), nullable=False)
    date = Column(Date, nullable=False)
    location = Column(String, nullable=False)
    sentiment_score = Column(Float, nullable=False)

    candidate = relationship("Candidate", back_populates="campaign_activities")

class ElectionHistory(Base):
    __tablename__ = "election_history"

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=False)
    year = Column(Integer, nullable=False)
    votes_received = Column(Integer, nullable=False)
    result_status = Column(String, nullable=False)

    candidate = relationship("Candidate", back_populates="election_history")
