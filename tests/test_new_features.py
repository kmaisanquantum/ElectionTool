import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from api import models, schemas
from utils.string_matching import normalize_candidate_name
from datetime import date
from pydantic import ValidationError

# Setup in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session():
    models.Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        models.Base.metadata.drop_all(bind=engine)

def test_fuzzy_matching():
    candidates = ["James Marape", "Peter O'Neill", "Sam Basil"]

    # Exact match
    assert normalize_candidate_name("James Marape", candidates) == "James Marape"

    # Close match
    assert normalize_candidate_name("James Marrape", candidates) == "James Marape"
    assert normalize_candidate_name("P. O'Neill", candidates, threshold=70) == "Peter O'Neill"

    # No match above threshold
    assert normalize_candidate_name("Unknown Name", candidates, threshold=90) == "Unknown Name"

def test_relational_models(db_session):
    # Create an electorate
    electorate = models.Electorate(name="Moresby South", province="NCD", type="Open")
    db_session.add(electorate)
    db_session.commit()
    db_session.refresh(electorate)

    # Create a candidate
    candidate = models.Candidate(name="Justin Tkatchenko", electorate_id=electorate.id, incumbent_status=True)
    db_session.add(candidate)
    db_session.commit()
    db_session.refresh(candidate)

    # Create campaign activity
    activity = models.CampaignActivity(
        candidate_id=candidate.id,
        activity_type=models.ActivityType.Rally,
        date=date(2022, 5, 20),
        location="Koki",
        sentiment_score=0.8
    )
    db_session.add(activity)

    # Create election history
    history = models.ElectionHistory(
        candidate_id=candidate.id,
        year=2017,
        votes_received=15000,
        result_status="Elected"
    )
    db_session.add(history)
    db_session.commit()

    # Verify relationships
    queried_candidate = db_session.query(models.Candidate).filter(models.Candidate.id == candidate.id).first()
    assert len(queried_candidate.campaign_activities) == 1
    assert queried_candidate.campaign_activities[0].location == "Koki"
    assert len(queried_candidate.election_history) == 1
    assert queried_candidate.election_history[0].year == 2017
    assert queried_candidate.electorate.name == "Moresby South"

def test_pydantic_sentiment_validation():
    # Valid sentiment
    activity = schemas.CampaignActivityBase(
        activity_type=schemas.ActivityType.Rally,
        date=date(2022, 5, 20),
        location="Koki",
        sentiment_score=0.5
    )
    assert activity.sentiment_score == 0.5

    # Invalid sentiment (too high)
    with pytest.raises(ValidationError):
        schemas.CampaignActivityBase(
            activity_type=schemas.ActivityType.Rally,
            date=date(2022, 5, 20),
            location="Koki",
            sentiment_score=1.5
        )

    # Invalid sentiment (too low)
    with pytest.raises(ValidationError):
        schemas.CampaignActivityBase(
            activity_type=schemas.ActivityType.Rally,
            date=date(2022, 5, 20),
            location="Koki",
            sentiment_score=-1.1
        )

def test_api_route_logic(db_session):
    # Populate data
    e1 = models.Electorate(name="E1", province="P1", type="T1")
    e2 = models.Electorate(name="E2", province="P2", type="T2")
    db_session.add_all([e1, e2])
    db_session.commit()

    c1 = models.Candidate(name="C1", electorate_id=e1.id, incumbent_status=True)
    c2 = models.Candidate(name="C2", electorate_id=e2.id, incumbent_status=False)
    db_session.add_all([c1, c2])
    db_session.commit()

    # Test filtering logic (mocking the query)
    query = db_session.query(models.Candidate)

    # Filter by electorate_id
    res = query.filter(models.Candidate.electorate_id == e1.id).all()
    assert len(res) == 1
    assert res[0].name == "C1"

    # Filter by incumbent_status
    res = query.filter(models.Candidate.incumbent_status == False).all()
    assert len(res) == 1
    assert res[0].name == "C2"
