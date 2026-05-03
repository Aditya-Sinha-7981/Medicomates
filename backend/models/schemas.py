from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


Role = Literal["patient", "doctor"]


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
