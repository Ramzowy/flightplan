"""Clinical data provider abstraction. The demo uses MockClinicalProvider only."""

import uuid
from collections.abc import Sequence
from typing import Protocol

from app.models import BillItem, BillStatement, CareEvent, Encounter, InsuranceCoverage, Medication, Procedure


class ClinicalDataProvider(Protocol):
    source_system: str

    def list_encounters(self, patient_id: uuid.UUID) -> Sequence[Encounter]: ...

    def list_events(self, encounter_id: uuid.UUID) -> Sequence[CareEvent]: ...

    def list_medications(self, encounter_id: uuid.UUID) -> Sequence[Medication]: ...

    def list_procedures(self, encounter_id: uuid.UUID) -> Sequence[Procedure]: ...

    # Read-only billing-office data (CONTRACT §10). FlightPlan never writes or computes it.
    def get_coverage(self, patient_id: uuid.UUID) -> InsuranceCoverage | None: ...

    def list_bill_items(self, patient_id: uuid.UUID) -> Sequence[BillItem]: ...

    def list_bill_statements(self, patient_id: uuid.UUID) -> Sequence[BillStatement]: ...
