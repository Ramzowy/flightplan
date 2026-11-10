from sqlalchemy.orm import Session

from app.config import get_settings
from app.integrations.base import ClinicalDataProvider
from app.integrations.fhir import FhirClinicalProvider
from app.integrations.mock import MockClinicalProvider


def get_provider(db: Session) -> ClinicalDataProvider:
    if get_settings().clinical_data_provider.lower() == "fhir":
        return FhirClinicalProvider()
    return MockClinicalProvider(db)
