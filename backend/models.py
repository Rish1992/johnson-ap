"""SQLAlchemy models matching frontend TypeScript types."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Boolean, Integer, Float, Text, DateTime, JSON, ForeignKey, Index
)
from db import Base


def new_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:12]}" if prefix else uuid.uuid4().hex[:12]


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------
class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    role = Column(String, nullable=False)  # AP_AGENT | AP_REVIEWER | SUPER_ADMIN
    department = Column(String, default="")
    is_active = Column(Boolean, default=True)
    approval_limit = Column(Float, nullable=True)
    permissions = Column(JSON, default=dict)  # {"canEditPrompts": bool, "canEditTechnical": bool}
    last_login_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "firstName": self.first_name,
            "lastName": self.last_name,
            "fullName": f"{self.first_name} {self.last_name}",
            "role": self.role,
            "department": self.department,
            "isActive": self.is_active,
            "approvalLimit": self.approval_limit,
            "permissions": self.permissions or {},
            "lastLoginAt": self.last_login_at.isoformat() + "Z" if self.last_login_at else None,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# Email (inbox record)
# ---------------------------------------------------------------------------
class Email(Base):
    __tablename__ = "emails"

    id = Column(String, primary_key=True, default=lambda: new_id("EM-"))
    from_address = Column(String, nullable=False)
    from_name = Column(String, default="")
    to_address = Column(String, default="ap@jhta.com.au")
    subject = Column(String, nullable=False)
    body = Column(Text, default="")
    attachments = Column(JSON, default=list)  # [{fileName, fileType, fileSize, fileUrl}]
    classification = Column(String, nullable=True)  # INVOICE | NON_INVOICE
    invoice_category = Column(String, nullable=True)
    classification_confidence = Column(Float, nullable=True)
    linked_case_id = Column(String, nullable=True)
    po_type = Column(String, nullable=True)  # PO | NON_PO
    entity = Column(String, nullable=True)  # AU | NZ
    status = Column(String, default="UNCLASSIFIED")  # UNCLASSIFIED | CLASSIFIED | LINKED
    received_at = Column(DateTime, default=utcnow)
    created_at = Column(DateTime, default=utcnow)

    def to_dict(self):
        atts = self.attachments or []
        return {
            "id": self.id,
            "from": self.from_address,
            "fromName": self.from_name,
            "to": self.to_address,
            "subject": self.subject,
            "body": self.body,
            "attachments": atts,
            "attachmentCount": len(atts),
            "classification": self.classification,
            "invoiceCategory": self.invoice_category,
            "classificationConfidence": self.classification_confidence,
            "linkedCaseId": self.linked_case_id,
            "isRead": self.status == "LINKED",  # read once linked to a case
            "poType": self.po_type,
            "entity": self.entity,
            "status": self.status,
            "receivedAt": self.received_at.isoformat() + "Z" if self.received_at else None,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# Case
# ---------------------------------------------------------------------------
class Case(Base):
    __tablename__ = "cases"

    id = Column(String, primary_key=True)  # CASE-NNNN
    status = Column(String, nullable=False, default="RECEIVED", index=True)
    category = Column(String, nullable=True)
    email = Column(JSON, default=dict)  # {from, to, subject, receivedAt, body, attachmentCount}
    attachments = Column(JSON, default=list)
    header_data = Column(JSON, default=dict)
    line_items = Column(JSON, default=list)
    confidence_scores = Column(JSON, default=dict)
    supporting_data = Column(JSON, default=dict)
    extracted_fields = Column(JSON, default=list)
    overall_confidence = Column(Float, default=0.0)
    overall_confidence_level = Column(String, default="LOW")
    vendor_id = Column(String, default="")
    vendor_name = Column(String, default="")
    vendor_number = Column(String, default="")
    contract_number = Column(String, nullable=True)
    contract_status = Column(String, nullable=True)
    business_rule_results = Column(JSON, default=list)
    approval_chain = Column(JSON, nullable=True)
    assigned_agent_id = Column(String, nullable=True)
    assigned_agent_name = Column(String, nullable=True)
    locked_by = Column(String, nullable=True)
    locked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
    sla_deadline = Column(DateTime, nullable=True)
    is_sla_breach = Column(Boolean, default=False)
    sap_document_number = Column(String, nullable=True)
    posted_at = Column(DateTime, nullable=True)
    returned_by = Column(String, nullable=True)
    returned_by_name = Column(String, nullable=True)
    return_reason = Column(String, nullable=True)
    returned_at = Column(DateTime, nullable=True)
    returned_from_step = Column(Integer, nullable=True)
    rejected_by = Column(String, nullable=True)
    rejected_by_name = Column(String, nullable=True)
    rejection_reason = Column(String, nullable=True)
    rejected_at = Column(DateTime, nullable=True)
    po_type = Column(String, nullable=True)
    entity = Column(String, nullable=True)
    freight_type = Column(String, nullable=True)  # SEA | AIR (freight categories only)
    is_read = Column(Boolean, default=False)
    email_id = Column(String, nullable=True)  # link back to Email record

    def to_dict(self):
        return {
            "id": self.id,
            "status": self.status,
            "category": self.category,
            "email": self.email or {},
            "attachments": self.attachments or [],
            "headerData": self.header_data or {},
            "lineItems": [
                {**li, "totalAmount": li.get("total", 0), "taxAmount": li.get("tax", 0),
                 "lineNumber": li.get("line", i+1), "id": str(i+1)}
                for i, li in enumerate(self.line_items or [])
            ],
            "confidenceScores": self.confidence_scores or {},
            "supportingData": self.supporting_data or {},
            "extractedFields": self.extracted_fields or [],
            "overallConfidence": self.overall_confidence,
            "overallConfidenceLevel": self.overall_confidence_level,
            "vendorId": self.vendor_id,
            "vendorName": self.vendor_name,
            "vendorNumber": self.vendor_number,
            "contractNumber": self.contract_number,
            "contractStatus": self.contract_status,
            "businessRuleResults": self.business_rule_results or [],
            "approvalChain": self.approval_chain,
            "assignedAgentId": self.assigned_agent_id,
            "assignedAgentName": self.assigned_agent_name,
            "lockedBy": self.locked_by,
            "lockedAt": self.locked_at.isoformat() + "Z" if self.locked_at else None,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() + "Z" if self.updated_at else None,
            "slaDeadline": self.sla_deadline.isoformat() + "Z" if self.sla_deadline else None,
            "isSlaBreach": self.is_sla_breach,
            "sapDocumentNumber": self.sap_document_number,
            "postedAt": self.posted_at.isoformat() + "Z" if self.posted_at else None,
            "returnedBy": self.returned_by,
            "returnedByName": self.returned_by_name,
            "returnReason": self.return_reason,
            "returnedAt": self.returned_at.isoformat() + "Z" if self.returned_at else None,
            "returnedFromStep": self.returned_from_step,
            "rejectedBy": self.rejected_by,
            "rejectedByName": self.rejected_by_name,
            "rejectionReason": self.rejection_reason,
            "rejectedAt": self.rejected_at.isoformat() + "Z" if self.rejected_at else None,
            "poType": self.po_type,
            "entity": self.entity,
            "freightType": self.freight_type,
            "isRead": self.is_read,
        }


# ---------------------------------------------------------------------------
# Attachment (separate table for file management)
# ---------------------------------------------------------------------------
class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(String, primary_key=True, default=lambda: new_id("ATT-"))
    case_id = Column(String, ForeignKey("cases.id"), nullable=True, index=True)
    email_id = Column(String, ForeignKey("emails.id"), nullable=True)
    file_name = Column(String, nullable=False)
    file_type = Column(String, default="PDF")
    file_size = Column(Integer, default=0)
    file_url = Column(String, default="")
    document_type = Column(String, default="OTHER")  # INVOICE | JOB_SHEET | SUPPORTING | OTHER
    is_main_invoice = Column(Boolean, default=False)
    uploaded_at = Column(DateTime, default=utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "fileName": self.file_name,
            "fileType": self.file_type,
            "fileSize": self.file_size,
            "fileUrl": self.file_url,
            "documentType": self.document_type,
            "isMainInvoice": self.is_main_invoice,
            "uploadedAt": self.uploaded_at.isoformat() + "Z" if self.uploaded_at else None,
        }


# ---------------------------------------------------------------------------
# AuditLog
# ---------------------------------------------------------------------------
class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=lambda: new_id("AUD-"))
    case_id = Column(String, ForeignKey("cases.id"), nullable=True, index=True)
    action = Column(String, nullable=False)
    category = Column(String, default="SYSTEM")  # SYSTEM | AGENT | APPROVER | ADMIN
    description = Column(Text, default="")
    performed_by = Column(String, default="SYSTEM")
    performed_by_name = Column(String, default="System")
    performed_by_role = Column(String, default="SYSTEM")
    timestamp = Column(DateTime, default=utcnow)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    field_name = Column(String, nullable=True)
    metadata_ = Column("metadata", JSON, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "caseId": self.case_id,
            "action": self.action,
            "category": self.category,
            "description": self.description,
            "performedBy": self.performed_by,
            "performedByName": self.performed_by_name,
            "performedByRole": self.performed_by_role,
            "timestamp": self.timestamp.isoformat() + "Z" if self.timestamp else None,
            "oldValue": self.old_value,
            "newValue": self.new_value,
            "fieldName": self.field_name,
            "metadata": self.metadata_,
        }


# ---------------------------------------------------------------------------
# Notification
# ---------------------------------------------------------------------------
class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=lambda: new_id("NTF-"))
    type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, default="")
    case_id = Column(String, nullable=True)
    recipient_id = Column(String, nullable=False, index=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "type": self.type,
            "title": self.title,
            "message": self.message,
            "caseId": self.case_id,
            "recipientId": self.recipient_id,
            "isRead": self.is_read,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# Comment
# ---------------------------------------------------------------------------
class Comment(Base):
    __tablename__ = "comments"

    id = Column(String, primary_key=True, default=lambda: new_id("CMT-"))
    case_id = Column(String, ForeignKey("cases.id"), nullable=False, index=True)
    step_number = Column(Integer, nullable=True)
    author_id = Column(String, nullable=False)
    author_name = Column(String, nullable=False)
    author_role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "caseId": self.case_id,
            "stepNumber": self.step_number,
            "authorId": self.author_id,
            "authorName": self.author_name,
            "authorRole": self.author_role,
            "content": self.content,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# PromptTemplate
# ---------------------------------------------------------------------------
class PromptTemplate(Base):
    __tablename__ = "prompt_templates"

    id = Column(String, primary_key=True, default=lambda: new_id("PT-"))
    step_name = Column(String, nullable=False, index=True)  # classify, categorize, verify_docs, extract, validate
    display_name = Column(String, nullable=False)
    technical_prompt = Column(Text, nullable=False)  # Developer-controlled, contains {{BUSINESS_RULES}} placeholder
    business_rules = Column(Text, nullable=False, default="")  # Business-editable rules/criteria
    output_schema = Column(JSON, nullable=True)
    version = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    created_by = Column(String, default="SYSTEM")
    created_at = Column(DateTime, default=utcnow)

    @property
    def assembled_prompt(self) -> str:
        return self.technical_prompt.replace("{{BUSINESS_RULES}}", self.business_rules)

    def to_dict(self):
        return {
            "id": self.id,
            "stepName": self.step_name,
            "displayName": self.display_name,
            "technicalPrompt": self.technical_prompt,
            "businessRules": self.business_rules,
            "assembledPrompt": self.assembled_prompt,
            "outputSchema": self.output_schema,
            "version": self.version,
            "isActive": self.is_active,
            "createdBy": self.created_by,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# Master Data Tables
# ---------------------------------------------------------------------------
class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(String, primary_key=True, default=lambda: new_id("VND-"))
    vendor_number = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    tax_id = Column(String, default="")
    address = Column(String, default="")
    city = Column(String, default="")
    country = Column(String, default="Australia")
    payment_terms = Column(String, default="NET30")
    bank_account = Column(String, default="")
    email = Column(String, default="")
    branch_code = Column(String, default="")
    currency = Column(String, default="AUD")
    is_active = Column(Boolean, default=True)
    contracts = Column(JSON, default=list)  # [{id, contractNumber, category, ...}]
    raw_data = Column(JSON, default=dict)  # full SAP row (49 cols) for lossless upload/download
    company_code = Column(String, default="")  # AU01 or NZ01
    bank_key = Column(String, default="")  # BSB number
    bank_account_number = Column(String, default="")  # account number

    def to_dict(self):
        return {
            "id": self.id,
            "vendorNumber": self.vendor_number,
            "name": self.name,
            "taxId": self.tax_id,
            "address": self.address,
            "city": self.city,
            "country": self.country,
            "paymentTerms": self.payment_terms,
            "bankAccount": self.bank_account,
            "email": self.email,
            "branchCode": self.branch_code,
            "currency": self.currency,
            "isActive": self.is_active,
            "contracts": self.contracts or [],
            "rawData": self.raw_data or {},
            "companyCode": self.company_code,
            "bankKey": self.bank_key,
            "bankAccountNumber": self.bank_account_number,
        }


class CostCenter(Base):
    __tablename__ = "cost_centers"

    id = Column(String, primary_key=True, default=lambda: new_id("CC-"))
    code = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    department = Column(String, default="")
    company_code = Column(String, default="")
    is_active = Column(Boolean, default=True)

    def to_dict(self):
        return {
            "id": self.id, "code": self.code, "name": self.name,
            "department": self.department, "companyCode": self.company_code,
            "isActive": self.is_active,
        }


class GLAccount(Base):
    __tablename__ = "gl_accounts"

    id = Column(String, primary_key=True, default=lambda: new_id("GL-"))
    account_number = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    type = Column(String, default="EXPENSE")  # EXPENSE | ASSET | LIABILITY
    company_code = Column(String, default="")
    is_active = Column(Boolean, default=True)

    def to_dict(self):
        return {
            "id": self.id, "accountNumber": self.account_number, "name": self.name,
            "type": self.type, "companyCode": self.company_code, "isActive": self.is_active,
        }


class TaxCode(Base):
    __tablename__ = "tax_codes"

    id = Column(String, primary_key=True, default=lambda: new_id("TX-"))
    code = Column(String, unique=True, nullable=False)
    description = Column(String, default="")
    rate = Column(Float, default=0.0)
    country = Column(String, default="Australia")
    is_active = Column(Boolean, default=True)

    def to_dict(self):
        return {
            "id": self.id, "code": self.code, "description": self.description,
            "rate": self.rate, "country": self.country, "isActive": self.is_active,
        }


class CompanyCode(Base):
    __tablename__ = "company_codes"

    id = Column(String, primary_key=True, default=lambda: new_id("COMP-"))
    code = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    country = Column(String, default="Australia")
    currency = Column(String, default="AUD")
    is_active = Column(Boolean, default=True)

    def to_dict(self):
        return {
            "id": self.id, "code": self.code, "name": self.name,
            "country": self.country, "currency": self.currency, "isActive": self.is_active,
        }


class PlantCode(Base):
    __tablename__ = "plant_codes"

    id = Column(String, primary_key=True, default=lambda: new_id("PLT-"))
    code = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    company_code = Column(String, default="")
    address = Column(String, default="")
    is_active = Column(Boolean, default=True)

    def to_dict(self):
        return {
            "id": self.id, "code": self.code, "name": self.name,
            "companyCode": self.company_code, "address": self.address, "isActive": self.is_active,
        }


class ApprovalRule(Base):
    __tablename__ = "approval_rules"

    id = Column(String, primary_key=True, default=lambda: new_id("AR-"))
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    min_amount = Column(Float, default=0.0)
    max_amount = Column(Float, default=999999999.0)
    required_approvers = Column(Integer, default=2)
    approver_ids = Column(JSON, default=list)
    sla_hours = Column(Integer, default=48)
    is_active = Column(Boolean, default=True)

    def to_dict(self):
        return {
            "id": self.id, "name": self.name, "category": self.category,
            "minAmount": self.min_amount, "maxAmount": self.max_amount,
            "requiredApprovers": self.required_approvers,
            "approverIds": self.approver_ids or [],
            "slaHours": self.sla_hours, "isActive": self.is_active,
        }


class BusinessRuleConfig(Base):
    __tablename__ = "business_rule_configs"

    id = Column(String, primary_key=True, default=lambda: new_id("BR-"))
    name = Column(String, nullable=False)
    description = Column(String, default="")
    category = Column(String, default="ALL")
    field = Column(String, default="")
    condition = Column(String, default="")
    severity = Column(String, default="WARNING")
    is_active = Column(Boolean, default=True)

    def to_dict(self):
        return {
            "id": self.id, "name": self.name, "description": self.description,
            "category": self.category, "field": self.field, "condition": self.condition,
            "severity": self.severity, "isActive": self.is_active,
        }


class FreightRateCard(Base):
    __tablename__ = "freight_rate_cards"

    id = Column(String, primary_key=True, default=lambda: new_id("FRC-"))
    origin = Column(String, default="")
    destination = Column(String, default="")
    container_type = Column(String, default="")
    rate = Column(Float, default=0.0)
    currency = Column(String, default="AUD")
    vendor_id = Column(String, default="")
    is_active = Column(Boolean, default=True)
    raw_data = Column(JSON, default=dict)  # full Excel row for lossless upload/download
    origin_port = Column(String, default="")  # port of loading
    dest_port = Column(String, default="")  # port of destination
    shipping_line = Column(String, default="")
    incoterm = Column(String, default="")
    freight_currency = Column(String, default="USD")
    dest_currency = Column(String, default="AUD")

    def to_dict(self):
        return {
            "id": self.id, "origin": self.origin, "destination": self.destination,
            "containerType": self.container_type, "rate": self.rate,
            "currency": self.currency, "vendorId": self.vendor_id, "isActive": self.is_active,
            "rawData": self.raw_data or {},
            "originPort": self.origin_port, "destPort": self.dest_port,
            "shippingLine": self.shipping_line, "incoterm": self.incoterm,
            "freightCurrency": self.freight_currency, "destCurrency": self.dest_currency,
        }


class ServiceRateCard(Base):
    __tablename__ = "service_rate_cards"

    id = Column(String, primary_key=True, default=lambda: new_id("SRC-"))
    service = Column(String, default="")
    rate = Column(Float, default=0.0)
    currency = Column(String, default="AUD")
    vendor_id = Column(String, default="")
    is_active = Column(Boolean, default=True)
    raw_data = Column(JSON, default=dict)  # full Excel row for lossless upload/download
    fee_type = Column(String, default="")  # Call Out Fee, Labor Costs, Travel Rate, Day Rate, Consumables
    contractor_name = Column(String, default="")
    charge_description = Column(String, default="")  # e.g. "incl first 30 min"

    def to_dict(self):
        return {
            "id": self.id, "service": self.service, "rate": self.rate,
            "currency": self.currency, "vendorId": self.vendor_id, "isActive": self.is_active,
            "rawData": self.raw_data or {},
            "feeType": self.fee_type, "contractorName": self.contractor_name,
            "chargeDescription": self.charge_description,
        }


class AgreementMaster(Base):
    __tablename__ = "agreement_masters"

    id = Column(String, primary_key=True, default=lambda: new_id("AGR-"))
    vendor_id = Column(String, default="")
    vendor_name = Column(String, default="")
    agreement_number = Column(String, default="")
    status = Column(String, default="Active")
    start_date = Column(String, default="")
    end_date = Column(String, default="")
    is_active = Column(Boolean, default=True)

    def to_dict(self):
        return {
            "id": self.id, "vendorId": self.vendor_id, "vendorName": self.vendor_name,
            "agreementNumber": self.agreement_number, "status": self.status,
            "startDate": self.start_date, "endDate": self.end_date, "isActive": self.is_active,
        }


class InvoiceCategoryConfig(Base):
    __tablename__ = "invoice_category_configs"

    id = Column(String, primary_key=True, default=lambda: new_id("ICC-"))
    name = Column(String, nullable=False)
    required_docs = Column(JSON, default=list)
    extraction_template_id = Column(String, default="")
    auth_chain_id = Column(String, default="")
    gl_account = Column(String, default="")
    invoice_fields = Column(JSON, default=list)       # [{key, label, type, required, validation, edgeCaseAction, sourceHint}]
    supporting_fields = Column(JSON, default=dict)     # {docTypeName: [{key, label, type, required, ...}]}
    validation_rules = Column(JSON, default=list)      # [{ruleId, ruleName, condition, severity, action}]
    is_active = Column(Boolean, default=True)

    def to_dict(self):
        return {
            "id": self.id, "name": self.name,
            "requiredDocs": self.required_docs or [],
            "extractionTemplateId": self.extraction_template_id,
            "authChainId": self.auth_chain_id,
            "glAccount": self.gl_account,
            "invoiceFields": self.invoice_fields or [],
            "supportingFields": self.supporting_fields or {},
            "validationRules": self.validation_rules or [],
            "isActive": self.is_active,
        }


class Job(Base):
    __tablename__ = "jobs"

    id = Column(String, primary_key=True)  # JOB-xxxx
    type = Column(String, nullable=False)  # "test_backend" | "test_frontend"
    status = Column(String, default="PENDING")  # PENDING | RUNNING | COMPLETED | FAILED
    current_step = Column(String, nullable=True)
    steps = Column(JSON, default=list)  # [{name, status, duration_ms, output, error}]
    case_id = Column(String, nullable=True)
    email_id = Column(String, nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    completed_at = Column(DateTime, nullable=True)

    def to_dict(self):
        return {
            "jobId": self.id,
            "type": self.type,
            "status": self.status,
            "currentStep": self.current_step,
            "steps": self.steps or [],
            "caseId": self.case_id,
            "emailId": self.email_id,
            "error": self.error,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
            "completedAt": self.completed_at.isoformat() + "Z" if self.completed_at else None,
        }


class ApprovalSequenceMaster(Base):
    __tablename__ = "approval_sequence_masters"

    id = Column(String, primary_key=True, default=lambda: new_id("ASM-"))
    invoice_type = Column(String, default="")
    name = Column(String, nullable=False)
    description = Column(String, default="")
    steps = Column(JSON, default=list)  # [{stepNumber, approverRole, approverName, approverId}]
    is_active = Column(Boolean, default=True)
    raw_data = Column(JSON, default=dict)  # full Excel row for lossless upload/download

    def to_dict(self):
        return {
            "id": self.id, "invoiceType": self.invoice_type, "name": self.name,
            "description": self.description, "steps": self.steps or [],
            "isActive": self.is_active,
            "rawData": self.raw_data or {},
        }
