from fastapi import APIRouter
from pydantic import BaseModel

from app.config import get_settings
from app.enums import ClinicalDataProviderType

router = APIRouter(prefix="/integrations", tags=["integrations"])


class IntegrationStatus(BaseModel):
    clinical_data_provider: ClinicalDataProviderType
    demo_mode: bool
    mychart_login_enabled: bool
    epic_launch_enabled: bool
    fhir_connected: bool
    message: str


@router.get("/status", response_model=IntegrationStatus)
def integration_status() -> IntegrationStatus:
    s = get_settings()
    provider = ClinicalDataProviderType(s.clinical_data_provider.upper())
    message = (
        "Demo — fictional medical data. Not connected to a hospital record."
        if provider == ClinicalDataProviderType.MOCK
        else "FHIR provider selected but not implemented. Not connected to a hospital record."
    )
    return IntegrationStatus(
        clinical_data_provider=provider,
        demo_mode=s.flightplan_demo_mode,
        mychart_login_enabled=s.enable_mychart_login,
        epic_launch_enabled=s.enable_epic_launch,
        fhir_connected=False,  # Never claims a live connection.
        message=message,
    )
