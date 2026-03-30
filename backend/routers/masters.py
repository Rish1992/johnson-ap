"""Master data CRUD — generic factory for all 14 entity types."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db import get_db
from models import (
    Vendor, CostCenter, GLAccount, TaxCode, CompanyCode, PlantCode,
    ApprovalRule, BusinessRuleConfig, FreightRateCard, ServiceRateCard,
    AgreementMaster, InvoiceCategoryConfig, ApprovalSequenceMaster, new_id,
)

router = APIRouter(prefix="/api/masters", tags=["masters"])

# Field mapping: camelCase body keys -> snake_case model attrs
# Only needed for non-trivial mappings; simple ones (name, code, etc.) handled by lowercasing
FIELD_MAP = {
    "vendorNumber": "vendor_number", "taxId": "tax_id", "paymentTerms": "payment_terms",
    "bankAccount": "bank_account", "branchCode": "branch_code", "isActive": "is_active",
    "companyCode": "company_code", "accountNumber": "account_number",
    "minAmount": "min_amount", "maxAmount": "max_amount",
    "requiredApprovers": "required_approvers", "approverIds": "approver_ids",
    "slaHours": "sla_hours", "containerType": "container_type",
    "vendorId": "vendor_id", "vendorName": "vendor_name",
    "agreementNumber": "agreement_number", "startDate": "start_date",
    "endDate": "end_date", "requiredDocs": "required_docs",
    "extractionTemplateId": "extraction_template_id",
    "authChainId": "auth_chain_id", "glAccount": "gl_account",
    "invoiceType": "invoice_type",
}


def _crud(model_cls, prefix: str, id_prefix: str):
    """Register GET (list), POST (create), PUT (update), DELETE for a model."""

    @router.get(f"/{prefix}")
    def list_all(db: Session = Depends(get_db)):
        return [r.to_dict() for r in db.query(model_cls).all()]

    @router.post(f"/{prefix}")
    def create(body: dict, db: Session = Depends(get_db)):
        obj = model_cls(id=new_id(id_prefix))
        _apply_body(obj, body)
        db.add(obj)
        db.commit()
        return obj.to_dict()

    @router.put(f"/{prefix}/{{item_id}}")
    def update(item_id: str, body: dict, db: Session = Depends(get_db)):
        obj = db.query(model_cls).filter(model_cls.id == item_id).first()
        if not obj:
            raise HTTPException(404, f"{model_cls.__name__} not found")
        _apply_body(obj, body)
        db.commit()
        return obj.to_dict()

    @router.delete(f"/{prefix}/{{item_id}}")
    def delete(item_id: str, db: Session = Depends(get_db)):
        obj = db.query(model_cls).filter(model_cls.id == item_id).first()
        if not obj:
            raise HTTPException(404, f"{model_cls.__name__} not found")
        db.delete(obj)
        db.commit()
        return {"success": True}

    # Rename functions to avoid FastAPI route conflicts
    list_all.__name__ = f"list_{prefix}"
    create.__name__ = f"create_{prefix}"
    update.__name__ = f"update_{prefix}"
    delete.__name__ = f"delete_{prefix}"


def _apply_body(obj, body: dict):
    """Apply camelCase body dict to snake_case model attributes."""
    for key, val in body.items():
        if key == "id":
            continue
        attr = FIELD_MAP.get(key, key)
        if hasattr(obj, attr):
            setattr(obj, attr, val)


# Register all master data CRUD routes
_crud(Vendor, "vendors", "VND-")
_crud(CostCenter, "cost-centers", "CC-")
_crud(GLAccount, "gl-accounts", "GL-")
_crud(TaxCode, "tax-codes", "TX-")
_crud(CompanyCode, "company-codes", "COMP-")
_crud(PlantCode, "plant-codes", "PLT-")
_crud(ApprovalRule, "approval-rules", "AR-")
_crud(BusinessRuleConfig, "business-rule-configs", "BR-")
_crud(FreightRateCard, "freight-rate-cards", "FRC-")
_crud(ServiceRateCard, "service-rate-cards", "SRC-")
_crud(AgreementMaster, "agreement-masters", "AGR-")
_crud(InvoiceCategoryConfig, "invoice-category-configs", "ICC-")
_crud(ApprovalSequenceMaster, "approval-sequences", "ASM-")
