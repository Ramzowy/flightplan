"""SMART on FHIR provider placeholder.

Not implemented: a real connection needs a health-system partnership, approved scopes and
credentials. This stub exists so the interface is explicit; it never pretends to be live.
"""

import uuid

_MESSAGE = (
    "FHIR clinical data provider is not implemented in this demo. "
    "Set CLINICAL_DATA_PROVIDER=mock."
)


class FhirClinicalProvider:
    source_system = "fhir"

    def list_encounters(self, patient_id: uuid.UUID):
        raise NotImplementedError(_MESSAGE)

    def list_events(self, encounter_id: uuid.UUID):
        raise NotImplementedError(_MESSAGE)

    def list_medications(self, encounter_id: uuid.UUID):
        raise NotImplementedError(_MESSAGE)

    def list_procedures(self, encounter_id: uuid.UUID):
        raise NotImplementedError(_MESSAGE)

    def get_coverage(self, patient_id: uuid.UUID):
        raise NotImplementedError(_MESSAGE)

    def list_bill_items(self, patient_id: uuid.UUID):
        raise NotImplementedError(_MESSAGE)

    def list_bill_statements(self, patient_id: uuid.UUID):
        raise NotImplementedError(_MESSAGE)
