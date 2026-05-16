from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


Role = Literal["patient", "doctor"]
ConnectionRequestType = Literal["doctor_patient", "reviewer"]


class RegisterSchema(BaseModel):
    email: str
    password: str = Field(min_length=6)
    role: Role
    full_name: str = Field(min_length=1)


class LoginSchema(BaseModel):
    email: str
    password: str = Field(min_length=6)


class MedicineSchema(BaseModel):
    patient_id: str
    name: str = Field(min_length=1)
    dosage: str = Field(min_length=1)
    frequency: str = Field(min_length=1)
    reminder_times: list[str]
    start_date: date | None = None
    end_date: date | None = None
    notes: str | None = None
    doctor_id: str | None = None
    quantity_on_hand: int | None = None
    units_per_day: float | None = None
    low_supply_threshold_days: int | None = Field(default=None, ge=1, le=365)
    is_critical: bool = False


class MedicineConfirmSchema(MedicineSchema):
    """Same body as add medicine, plus resolution metadata after warnings."""

    rxcui: str | None = None
    acknowledged_warnings: list[str] = Field(default_factory=list)


class MedicineUpdateSchema(BaseModel):
    patient_id: str
    name: str | None = None
    dosage: str | None = None
    frequency: str | None = None
    reminder_times: list[str] | None = None
    start_date: date | None = None
    end_date: date | None = None
    notes: str | None = None
    doctor_id: str | None = None
    quantity_on_hand: int | None = None
    units_per_day: float | None = None
    low_supply_threshold_days: int | None = Field(default=None, ge=1, le=365)
    is_critical: bool | None = None


class DoctorConnectionSchema(BaseModel):
    patient_id: str
    doctor_id: str


class ReviewerConnectionSchema(BaseModel):
    patient_id: str
    reviewer_email: str


class NoteSchema(BaseModel):
    patient_id: str
    doctor_id: str
    message: str = Field(min_length=1)
    is_urgent: bool = False


class NoteReadSchema(BaseModel):
    patient_id: str
    doctor_id: str


class MarkDoseSchema(BaseModel):
    patient_id: str
    medicine_id: str
    time: str = Field(min_length=4)  # "HH:MM"
    taken: bool


class ConnectionRequestSchema(BaseModel):
    to_email: str
    type: ConnectionRequestType
