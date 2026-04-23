from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from api import models, schemas
from api.database import get_db

router = APIRouter()

@router.get("/intelligence", response_model=List[schemas.CandidateIntelligence])
def get_candidate_intelligence(
    electorate_id: Optional[int] = Query(None, description="Filter by electorate ID"),
    incumbent_status: Optional[bool] = Query(None, description="Filter by incumbent status"),
    db: Session = Depends(get_db)
):
    """
    Fetch aggregated candidate intelligence, including campaign activities and election history.
    """
    query = db.query(models.Candidate).options(
        joinedload(models.Candidate.campaign_activities),
        joinedload(models.Candidate.election_history),
        joinedload(models.Candidate.electorate)
    )

    if electorate_id is not None:
        query = query.filter(models.Candidate.electorate_id == electorate_id)

    if incumbent_status is not None:
        query = query.filter(models.Candidate.incumbent_status == incumbent_status)

    candidates = query.all()

    # Map results to schema, populating electorate_name from the electorate relationship
    results = []
    for candidate in candidates:
        candidate_data = schemas.CandidateIntelligence.model_validate(candidate)
        if candidate.electorate:
            candidate_data.electorate_name = candidate.electorate.name
        results.append(candidate_data)

    return results
