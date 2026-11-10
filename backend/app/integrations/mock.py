"""Mock provider: reads the synthetic records written by app.seed."""

import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import BillItem, BillStatement, CareEvent, Encounter, InsuranceCoverage, Medication, Procedure


class MockClinicalProvider:
    source_system = "mock"

    def __init__(self, db: Session) -> None:
        self.db = db

    def list_encounters(self, patient_id: uuid.UUID) -> Sequence[Encounter]:
        return self.db.scalars(
            select(Encounter).where(Encounter.patient_id == patient_id).order_by(Encounter.start_at)
        ).all()

    def list_events(self, encounter_id: uuid.UUID) -> Sequence[CareEvent]:
        return self.db.scalars(
            select(CareEvent).where(CareEvent.encounter_id == encounter_id)
        ).all()

    def list_medications(self, encounter_id: uuid.UUID) -> Sequence[Medication]:
        return self.db.scalars(
            select(Medication)
            .where(Medication.encounter_id == encounter_id)
            .order_by(Medication.display_name)
        ).all()

    def list_procedures(self, encounter_id: uuid.UUID) -> Sequence[Procedure]:
        return self.db.scalars(
            select(Procedure).where(Procedure.encounter_id == encounter_id).order_by(Procedure.name)
        ).all()

    # --- billing office (mock-billing) ---------------------------------------------------

    def get_coverage(self, patient_id: uuid.UUID) -> InsuranceCoverage | None:
        return self.db.scalar(select(InsuranceCoverage).where(InsuranceCoverage.patient_id == patient_id))

    def list_bill_items(self, patient_id: uuid.UUID) -> Sequence[BillItem]:
        return self.db.scalars(
            select(BillItem)
            .where(BillItem.patient_id == patient_id)
            .order_by(BillItem.display_order, BillItem.description)
        ).all()

    def list_bill_statements(self, patient_id: uuid.UUID) -> Sequence[BillStatement]:
        return self.db.scalars(
            select(BillStatement)
            .where(BillStatement.patient_id == patient_id)
            .order_by(BillStatement.issued_on.desc().nulls_first())
        ).all()
