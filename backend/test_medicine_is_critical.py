"""
Task 1 — is_critical field tests (no Supabase required).

Run from backend/:
  python test_medicine_is_critical.py
"""

from datetime import date

from models.schemas import MedicineSchema, MedicineUpdateSchema


def test_medicine_schema_default_is_critical_false() -> None:
    med = MedicineSchema(
        patient_id="00000000-0000-0000-0000-000000000001",
        name="Metformin",
        dosage="500mg",
        frequency="twice daily",
        reminder_times=["08:00"],
    )
    assert med.is_critical is False


def test_medicine_schema_accepts_true() -> None:
    med = MedicineSchema(
        patient_id="00000000-0000-0000-0000-000000000001",
        name="Warfarin",
        dosage="5mg",
        frequency="once daily",
        reminder_times=["09:00"],
        is_critical=True,
    )
    assert med.is_critical is True


def test_medicine_update_schema_optional_is_critical() -> None:
    upd = MedicineUpdateSchema(
        patient_id="00000000-0000-0000-0000-000000000001",
        is_critical=False,
    )
    assert upd.is_critical is False
    dumped = upd.model_dump(exclude_unset=True)
    # patient_id is always set on update requests; medicines.py strips it before DB update.
    assert dumped["is_critical"] is False
    assert dumped["patient_id"] == "00000000-0000-0000-0000-000000000001"


def test_medicine_schema_serializes_is_critical_in_json_mode() -> None:
    med = MedicineSchema(
        patient_id="00000000-0000-0000-0000-000000000001",
        name="Amlodipine",
        dosage="5mg",
        frequency="once daily",
        reminder_times=["08:00"],
        start_date=date(2025, 1, 15),
        is_critical=True,
    )
    data = med.model_dump(mode="json")
    assert data["is_critical"] is True
    assert data["start_date"] == "2025-01-15"


def main() -> None:
    tests = [
        test_medicine_schema_default_is_critical_false,
        test_medicine_schema_accepts_true,
        test_medicine_update_schema_optional_is_critical,
        test_medicine_schema_serializes_is_critical_in_json_mode,
    ]
    for fn in tests:
        fn()
        print(f"  OK  {fn.__name__}")
    print(f"\nAll {len(tests)} tests passed.")


if __name__ == "__main__":
    main()
