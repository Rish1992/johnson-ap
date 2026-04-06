"""Seed test users, master data (real Johnson data), and default prompt templates."""

from sqlalchemy.orm import Session
from models import (
    User, Vendor, CostCenter, GLAccount, TaxCode, CompanyCode, PlantCode,
    ApprovalRule, BusinessRuleConfig, FreightRateCard, ServiceRateCard,
    AgreementMaster, InvoiceCategoryConfig, ApprovalSequenceMaster, PromptTemplate,
)
from auth import hash_password

PW = hash_password("password123")


def seed_all(db: Session):
    """Seed everything if DB is empty."""
    if db.query(User).count() > 0:
        return  # Already seeded
    _seed_users(db)
    _seed_company_codes(db)
    _seed_plant_codes(db)
    _seed_cost_centers(db)
    _seed_gl_accounts(db)
    _seed_tax_codes(db)
    _seed_vendors(db)
    _seed_approval_rules(db)
    _seed_business_rule_configs(db)
    _seed_invoice_category_configs(db)
    _seed_approval_sequences(db)
    _seed_freight_rate_cards(db)
    _seed_service_rate_cards(db)
    _seed_agreement_masters(db)
    _seed_prompt_templates(db)
    db.commit()


# ---------------------------------------------------------------------------
# Users (matching mock data: sarah agent, john/emma approvers, alex admin)
# + real Johnson approvers from Process Design
# ---------------------------------------------------------------------------
def _seed_users(db: Session):
    users = [
        # Test users (match frontend mock)
        User(id="agent-001", email="sarah.chen@company.com", password_hash=PW,
             first_name="Sarah", last_name="Chen", role="AP_AGENT", department="Finance"),
        User(id="agent-002", email="mike.ross@company.com", password_hash=PW,
             first_name="Mike", last_name="Ross", role="AP_AGENT", department="Finance"),
        User(id="approver-001", email="john.williams@company.com", password_hash=PW,
             first_name="John", last_name="Williams", role="AP_REVIEWER", department="Operations", approval_limit=50000),
        User(id="approver-002", email="emma.thompson@company.com", password_hash=PW,
             first_name="Emma", last_name="Thompson", role="AP_REVIEWER", department="Finance", approval_limit=25000),
        User(id="admin-001", email="alex.kumar@company.com", password_hash=PW,
             first_name="Alex", last_name="Kumar", role="SUPER_ADMIN", department="IT",
             permissions={}),
        # Tech admin — full prompt access
        User(id="tech-001", email="samrat@aistra.com", password_hash=PW,
             first_name="Samrat", last_name="Sah", role="SUPER_ADMIN", department="Technology",
             permissions={"canEditPrompts": True, "canEditTechnical": True}),
        # Business admin — business rules only
        User(id="biz-001", email="prafulla@aistra.com", password_hash=PW,
             first_name="Prafulla", last_name="Patil", role="SUPER_ADMIN", department="Business",
             permissions={"canEditPrompts": True, "canEditTechnical": False}),
        # Real Johnson approvers (from Process Design approval hierarchies)
        User(id="approver-lisa", email="lisa.cubela@jhta.com.au", password_hash=PW,
             first_name="Lisa", last_name="Cubela", role="AP_REVIEWER", department="Service", approval_limit=50000),
        User(id="approver-haran", email="haran.ainkharan@jhta.com.au", password_hash=PW,
             first_name="Haran", last_name="Ainkharan", role="AP_REVIEWER", department="Finance", approval_limit=999999),
        User(id="approver-jai", email="jai.prasad@jhta.com.au", password_hash=PW,
             first_name="Jai", last_name="Prasad", role="AP_REVIEWER", department="D&I", approval_limit=50000),
        User(id="approver-simon", email="simon@jhta.com.au", password_hash=PW,
             first_name="Simon", last_name="", role="AP_REVIEWER", department="D&I", approval_limit=50000),
        User(id="approver-vinay", email="vinay.nirooban@jhta.com.au", password_hash=PW,
             first_name="Vinay", last_name="Nirooban", role="AP_REVIEWER", department="Commercial", approval_limit=75000),
        User(id="approver-ken", email="ken.mori@jhta.com.au", password_hash=PW,
             first_name="Ken", last_name="Mori", role="AP_REVIEWER", department="Spare Parts", approval_limit=75000),
        User(id="approver-sam", email="sam.forbes@jhta.com.au", password_hash=PW,
             first_name="Sam", last_name="Forbes", role="AP_REVIEWER", department="Commercial", approval_limit=50000),
    ]
    db.add_all(users)


# ---------------------------------------------------------------------------
# Company & Plant Codes
# ---------------------------------------------------------------------------
def _seed_company_codes(db: Session):
    db.add_all([
        CompanyCode(id="COMP-AU", code="JHTA", name="Johnson Health Tech Australia Pty Ltd", country="Australia", currency="AUD"),
        CompanyCode(id="COMP-NZ", code="JHTNZ", name="Johnson Health Tech New Zealand Ltd", country="New Zealand", currency="NZD"),
    ])


def _seed_plant_codes(db: Session):
    db.add_all([
        PlantCode(id="PLT-SYD", code="1000", name="Sydney Head Office", company_code="JHTA", address="Sydney, NSW"),
        PlantCode(id="PLT-MEL", code="2000", name="Melbourne Warehouse", company_code="JHTA", address="Melbourne, VIC"),
        PlantCode(id="PLT-BRI", code="3000", name="Brisbane Office", company_code="JHTA", address="Brisbane, QLD"),
        PlantCode(id="PLT-NZ", code="4000", name="Auckland Office", company_code="JHTNZ", address="Auckland, NZ"),
    ])


# ---------------------------------------------------------------------------
# Cost Centers (from Process Design: Home / Commercial / E-Commerce + Warehouse)
# ---------------------------------------------------------------------------
def _seed_cost_centers(db: Session):
    db.add_all([
        CostCenter(id="CC-HOME", code="CC-HOME", name="Home", department="Service", company_code="JHTA"),
        CostCenter(id="CC-COMM", code="CC-COMMERCIAL", name="Commercial", department="Commercial", company_code="JHTA"),
        CostCenter(id="CC-ECOM", code="CC-ECOMMERCE", name="E-Commerce", department="E-Commerce", company_code="JHTA"),
        CostCenter(id="CC-WH", code="CC-WAREHOUSE", name="Warehouse", department="Warehouse", company_code="JHTA"),
        CostCenter(id="CC-NZ", code="CC-NZ-COMMERCIAL", name="NZ Commercial", department="Commercial", company_code="JHTNZ"),
    ])


# ---------------------------------------------------------------------------
# GL Accounts (from Process Design: per category GL codes)
# ---------------------------------------------------------------------------
def _seed_gl_accounts(db: Session):
    db.add_all([
        GLAccount(id="GL-SUBCON-WAR", account_number="614100", name="Subcontractor Expense - Warranty", type="EXPENSE", company_code="JHTA"),
        GLAccount(id="GL-SUBCON-CHG", account_number="614200", name="Subcontractor Expense - Chargeable", type="EXPENSE", company_code="JHTA"),
        GLAccount(id="GL-DI", account_number="615100", name="Delivery & Installation", type="EXPENSE", company_code="JHTA"),
        GLAccount(id="GL-FRT-FG", account_number="616100", name="Freight - Finished Goods", type="EXPENSE", company_code="JHTA"),
        GLAccount(id="GL-FRT-SP", account_number="616200", name="Freight - Spare Parts", type="EXPENSE", company_code="JHTA"),
        GLAccount(id="GL-FRT-ADD", account_number="616300", name="Freight - Additional Charges", type="EXPENSE", company_code="JHTA"),
        GLAccount(id="GL-LEGAL", account_number="617100", name="Legal Expenses", type="EXPENSE", company_code="JHTA"),
        GLAccount(id="GL-MKTG", account_number="618100", name="Marketing Expenses", type="EXPENSE", company_code="JHTA"),
    ])


# ---------------------------------------------------------------------------
# Tax Codes (Australian GST)
# ---------------------------------------------------------------------------
def _seed_tax_codes(db: Session):
    db.add_all([
        TaxCode(id="TX-GST10", code="P1", description="GST 10%", rate=10.0, country="Australia"),
        TaxCode(id="TX-FREE", code="P2", description="GST Free", rate=0.0, country="Australia"),
        TaxCode(id="TX-NZ15", code="NZ15", description="NZ GST 15%", rate=15.0, country="New Zealand"),
        TaxCode(id="TX-EXEMPT", code="EX", description="Tax Exempt", rate=0.0, country="Australia"),
    ])


# ---------------------------------------------------------------------------
# Vendors (real Johnson vendors from Process Design)
# ---------------------------------------------------------------------------
def _seed_vendors(db: Session):
    db.add_all([
        # --- Subcontractor ---
        Vendor(id="VND-REVO", vendor_number="V200001", name="RevoFit Pty Ltd ATF The NewFit Unit Trust",
               tax_id="", address="", city="Sydney", country="Australia",
               payment_terms="NET30", currency="AUD",
               contracts=[
                   {"id": "CON-REVO-1", "vendorId": "VND-REVO", "contractNumber": "REVO-SUB-2024",
                    "category": "SUBCONTRACTOR", "startDate": "2024-01-01", "endDate": "2026-12-31",
                    "maxAmount": 500000, "isActive": True},
               ]),
        Vendor(id="VND-FLEETFIT", vendor_number="V200005", name="Fleet Fitness Pty Ltd",
               tax_id="", address="", city="Sydney", country="Australia",
               payment_terms="NET30", currency="AUD",
               contracts=[
                   {"id": "CON-FF-1", "vendorId": "VND-FLEETFIT", "contractNumber": "FF-SUB-2024",
                    "category": "SUBCONTRACTOR", "startDate": "2024-01-01", "endDate": "2026-12-31",
                    "maxAmount": 400000, "isActive": True},
               ]),
        Vendor(id="VND-GENSUBCON", vendor_number="V200003", name="General Subcontractor Services",
               tax_id="", city="Melbourne", country="Australia",
               payment_terms="NET30", currency="AUD", contracts=[]),
        # --- Delivery & Installation ---
        Vendor(id="VND-DI-01", vendor_number="V200004", name="D&I Installation Services",
               tax_id="", city="Sydney", country="Australia",
               payment_terms="NET30", currency="AUD", contracts=[]),
        Vendor(id="VND-TOYOTA", vendor_number="V200006", name="Toyota Material Handling Australia",
               tax_id="", address="", city="Melbourne", country="Australia",
               payment_terms="NET45", currency="AUD",
               contracts=[
                   {"id": "CON-TMH-1", "vendorId": "VND-TOYOTA", "contractNumber": "TMH-DI-2024",
                    "category": "DELIVERY_INSTALLATION", "startDate": "2024-01-01", "endDate": "2026-12-31",
                    "maxAmount": 300000, "isActive": True},
               ]),
        # --- Freight ---
        Vendor(id="VND-MAINFREIGHT", vendor_number="V200002", name="Mainfreight Air & Ocean Pty Ltd",
               tax_id="", address="", city="Sydney", country="Australia",
               payment_terms="NET30", currency="AUD",
               contracts=[
                   {"id": "CON-MF-1", "vendorId": "VND-MAINFREIGHT", "contractNumber": "MF-FRT-2024",
                    "category": "FREIGHT_FINISHED_GOODS", "startDate": "2024-01-01", "endDate": "2026-12-31",
                    "maxAmount": 2000000, "isActive": True},
               ]),
        Vendor(id="VND-DHL", vendor_number="V200007", name="DHL Supply Chain (Australia) Pty Ltd",
               tax_id="", address="", city="Sydney", country="Australia",
               payment_terms="NET30", currency="AUD",
               contracts=[
                   {"id": "CON-DHL-1", "vendorId": "VND-DHL", "contractNumber": "DHL-FRT-2024",
                    "category": "FREIGHT_FINISHED_GOODS", "startDate": "2024-01-01", "endDate": "2026-12-31",
                    "maxAmount": 1500000, "isActive": True},
               ]),
        Vendor(id="VND-BOOTHS", vendor_number="V200008", name="Booths Transport Pty Ltd",
               tax_id="", address="", city="Melbourne", country="Australia",
               payment_terms="NET30", currency="AUD",
               contracts=[
                   {"id": "CON-BT-1", "vendorId": "VND-BOOTHS", "contractNumber": "BT-FRT-2024",
                    "category": "FREIGHT_FINISHED_GOODS", "startDate": "2024-01-01", "endDate": "2026-12-31",
                    "maxAmount": 800000, "isActive": True},
               ]),
        Vendor(id="VND-AGGREGATOR", vendor_number="V200009", name="Aggregator Logistics Pty Ltd",
               tax_id="", address="", city="Brisbane", country="Australia",
               payment_terms="NET30", currency="AUD",
               contracts=[
                   {"id": "CON-AGG-1", "vendorId": "VND-AGGREGATOR", "contractNumber": "AGG-FRT-2024",
                    "category": "FREIGHT_SPARE_PARTS", "startDate": "2024-01-01", "endDate": "2026-12-31",
                    "maxAmount": 600000, "isActive": True},
               ]),
        Vendor(id="VND-EFM", vendor_number="V200010", name="EFM Logistics Pty Ltd",
               tax_id="", address="", city="Sydney", country="Australia",
               payment_terms="NET30", currency="AUD",
               contracts=[
                   {"id": "CON-EFM-1", "vendorId": "VND-EFM", "contractNumber": "EFM-FRT-2024",
                    "category": "FREIGHT_SPARE_PARTS", "startDate": "2024-01-01", "endDate": "2026-12-31",
                    "maxAmount": 500000, "isActive": True},
               ]),
        # --- Legal ---
        Vendor(id="VND-MST", vendor_number="V200011", name="MST Lawyers",
               tax_id="", address="", city="Melbourne", country="Australia",
               payment_terms="NET14", currency="AUD", contracts=[]),
        Vendor(id="VND-HWL", vendor_number="V200012", name="HWL Ebsworth Lawyers",
               tax_id="", address="", city="Sydney", country="Australia",
               payment_terms="NET14", currency="AUD", contracts=[]),
        # --- Waste & Storage ---
        Vendor(id="VND-NATIONWIDE", vendor_number="V200013", name="Nationwide Waste Solutions Pty Ltd",
               tax_id="", address="", city="Melbourne", country="Australia",
               payment_terms="NET30", currency="AUD", contracts=[]),
        Vendor(id="VND-SUZI", vendor_number="V200014", name="Suzi's Transport & Logistics",
               tax_id="", address="", city="Sydney", country="Australia",
               payment_terms="NET30", currency="AUD", contracts=[]),
        # --- NZ Vendor ---
        Vendor(id="VND-MAINFREIGHT-NZ", vendor_number="V200015", name="Mainfreight Ltd (NZ)",
               tax_id="", address="", city="Auckland", country="New Zealand",
               payment_terms="NET30", currency="NZD",
               contracts=[
                   {"id": "CON-MFNZ-1", "vendorId": "VND-MAINFREIGHT-NZ", "contractNumber": "MFNZ-FRT-2024",
                    "category": "FREIGHT_FINISHED_GOODS", "startDate": "2024-01-01", "endDate": "2026-12-31",
                    "maxAmount": 1000000, "isActive": True},
               ]),
    ])


# ---------------------------------------------------------------------------
# Approval Rules (from Process Design: category -> L1/L2 approvers)
# ---------------------------------------------------------------------------
def _seed_approval_rules(db: Session):
    rules = [
        ("SUBCONTRACTOR", "Subcontractor L1+L2", ["approver-lisa", "approver-haran"]),
        ("RUST_SUBCONTRACTOR", "Rust Subcontractor L1+L2", ["approver-lisa", "approver-haran"]),
        ("DELIVERY_INSTALLATION", "D&I L1+L2", ["approver-jai", "approver-haran"]),
        ("FREIGHT_FINISHED_GOODS", "Freight FG L1+L2", ["approver-vinay", "approver-haran"]),
        ("FREIGHT_SPARE_PARTS", "Freight SP L1+L2", ["approver-ken", "approver-haran"]),
        ("FREIGHT_ADDITIONAL_CHARGES", "Freight Add L1+L2", ["approver-sam", "approver-haran"]),
    ]
    for cat, name, ids in rules:
        db.add(ApprovalRule(
            name=name, category=cat, min_amount=0, max_amount=999999999,
            required_approvers=2, approver_ids=ids, sla_hours=48,
        ))


# ---------------------------------------------------------------------------
# Business Rule Configs
# ---------------------------------------------------------------------------
def _seed_business_rule_configs(db: Session):
    configs = [
        ("Vendor Bank Match", "Invoice bank details must match vendor master", "ALL", "bankDetails", "MATCH_VENDOR_MASTER", "ERROR"),
        ("Invoice Amount Positive", "Invoice total must be positive", "ALL", "totalAmount", "GREATER_THAN_ZERO", "ERROR"),
        ("Tax Calculation", "Tax amount must equal net * tax rate", "ALL", "taxAmount", "EQUALS_NET_TIMES_RATE", "WARNING"),
        ("Worksheet Number Match", "Contractor worksheet number must match invoice reference", "SUBCONTRACTOR", "worksheetNumber", "MATCH_SUPPORTING_DOC", "ERROR"),
        ("Quote Amount Match", "Invoice subtotal must match installation worksheet quote", "DELIVERY_INSTALLATION", "subtotal", "MATCH_QUOTE_AMOUNT", "ERROR"),
        ("Rate Card Match", "Freight rates must match contracted rate card", "FREIGHT_FINISHED_GOODS", "rate", "MATCH_RATE_CARD", "WARNING"),
        ("Entity Billing Match", "AU vendor must bill to AU entity; NZ vendor to NZ entity", "ALL", "entity", "MATCH_VENDOR_ENTITY", "ERROR"),
    ]
    for name, desc, cat, field, cond, sev in configs:
        db.add(BusinessRuleConfig(name=name, description=desc, category=cat, field=field, condition=cond, severity=sev))


# ---------------------------------------------------------------------------
# Invoice Category Configs (from Process Design mandatory doc matrix)
# ---------------------------------------------------------------------------
def _seed_invoice_category_configs(db: Session):
    # --- Common invoice fields (16 fields, shared across all categories) ---
    _INV_FIELDS = [
        {"key": "vendorName", "label": "Vendor Name", "type": "text", "required": True, "validation": "vendor_master", "edgeCaseAction": "flag_reviewer", "sourceHint": "Top of invoice"},
        {"key": "vendorAddress", "label": "Vendor Address", "type": "text", "required": True, "validation": "vendor_master_au", "edgeCaseAction": "flag_reviewer", "sourceHint": "Below vendor name"},
        {"key": "vendorABN", "label": "Vendor ABN", "type": "text", "required": True, "validation": "vendor_master", "edgeCaseAction": "flag_reviewer", "sourceHint": "Near vendor details"},
        {"key": "billTo", "label": "Bill To", "type": "text", "required": True, "validation": "entity_id", "edgeCaseAction": "flag_reviewer", "sourceHint": "Bill To section"},
        {"key": "invoiceNumber", "label": "Invoice Number", "type": "text", "required": True, "validation": "unique_duplicate_check", "edgeCaseAction": "flag_reviewer", "sourceHint": "Header area"},
        {"key": "invoiceDate", "label": "Invoice Date", "type": "date", "required": True, "validation": "date_format", "edgeCaseAction": "flag_reviewer", "sourceHint": "Header area"},
        {"key": "attachmentReference", "label": "Attachment Reference", "type": "text", "required": True, "validation": "cross_ref_worksheet", "edgeCaseAction": "flag_reviewer", "sourceHint": "Reference/job number on invoice"},
        {"key": "description", "label": "Description", "type": "text", "required": True, "validation": "not_empty", "edgeCaseAction": "flag_reviewer", "sourceHint": "Line item area"},
        {"key": "quantity", "label": "Quantity", "type": "number", "required": True, "validation": "positive", "edgeCaseAction": "flag_reviewer", "sourceHint": "Line item area"},
        {"key": "unitPrice", "label": "Unit Price", "type": "currency", "required": True, "validation": "rate_card", "edgeCaseAction": "flag_reviewer", "sourceHint": "Line item area"},
        {"key": "totalPrice", "label": "Total Price", "type": "currency", "required": True, "validation": "math_check", "edgeCaseAction": "flag_reviewer", "sourceHint": "Line item area"},
        {"key": "subTotal", "label": "Sub-total", "type": "currency", "required": True, "validation": "math_check", "edgeCaseAction": "flag_reviewer", "sourceHint": "Totals section"},
        {"key": "taxAmount", "label": "Tax Amount", "type": "currency", "required": True, "validation": "tax_rate_check", "edgeCaseAction": "flag_reviewer", "sourceHint": "Totals section"},
        {"key": "grandTotal", "label": "Grand Total", "type": "currency", "required": True, "validation": "math_sum_check", "edgeCaseAction": "flag_reviewer", "sourceHint": "Totals section"},
        {"key": "currency", "label": "Currency", "type": "text", "required": True, "validation": "entity_currency_match", "edgeCaseAction": "flag_reviewer", "sourceHint": "Currency symbol or stated"},
        {"key": "bankDetails", "label": "Bank Details", "type": "text", "required": True, "validation": "vendor_master", "edgeCaseAction": "flag_reviewer", "sourceHint": "Bottom of invoice"},
    ]

    # --- Contractor supporting: Work Order (RevoFit) ---
    _WORK_ORDER_FIELDS = [
        {"key": "workOrderNumber", "label": "Work Order Number", "type": "text", "required": True, "validation": "cross_ref_invoice", "edgeCaseAction": "flag_reviewer", "sourceHint": "Header"},
        {"key": "customer", "label": "Customer", "type": "text", "required": True, "validation": "not_empty", "edgeCaseAction": "flag_reviewer", "sourceHint": "Customer section"},
        {"key": "customerAddress", "label": "Customer Address", "type": "text", "required": True, "validation": "not_empty", "edgeCaseAction": "flag_reviewer", "sourceHint": "Customer section"},
        {"key": "model", "label": "Model", "type": "text", "required": True, "validation": "not_empty", "edgeCaseAction": "flag_reviewer", "sourceHint": "Equipment section"},
        {"key": "baseSerial", "label": "Base Serial #", "type": "text", "required": True, "validation": "not_empty", "edgeCaseAction": "flag_reviewer", "sourceHint": "Equipment section"},
        {"key": "warrantyStatus", "label": "Warranty Status", "type": "text", "required": True, "validation": "category_id", "edgeCaseAction": "flag_reviewer", "sourceHint": "Determines SUBCONTRACTOR vs RUST"},
        {"key": "notes", "label": "Notes", "type": "text", "required": True, "validation": "not_empty", "edgeCaseAction": "flag_reviewer", "sourceHint": "Notes section"},
        {"key": "complaint", "label": "Complaint", "type": "text", "required": True, "validation": "not_empty", "edgeCaseAction": "flag_reviewer", "sourceHint": "Complaint section"},
        {"key": "workOrderDetails", "label": "Work Order Details", "type": "text", "required": True, "validation": "amount_match_invoice", "edgeCaseAction": "flag_reviewer", "sourceHint": "Details/amounts section"},
    ]

    # --- Contractor supporting: Contractor Worksheet ---
    _WORKSHEET_FIELDS = [
        {"key": "caseNumber", "label": "Case Number", "type": "text", "required": True, "validation": "cross_ref_invoice", "edgeCaseAction": "flag_reviewer", "sourceHint": "Header (JAU/CNR)"},
        {"key": "dateJobBooked", "label": "Date Job Booked", "type": "date", "required": True, "validation": "date_format", "edgeCaseAction": "flag_reviewer", "sourceHint": "Header"},
        {"key": "customerName", "label": "Customer Name", "type": "text", "required": True, "validation": "not_empty", "edgeCaseAction": "flag_reviewer", "sourceHint": "Customer section"},
        {"key": "customerAddress", "label": "Customer Address", "type": "text", "required": True, "validation": "not_empty", "edgeCaseAction": "flag_reviewer", "sourceHint": "Customer section"},
        {"key": "branch", "label": "Branch", "type": "text", "required": True, "validation": "cost_centre_map", "edgeCaseAction": "flag_reviewer", "sourceHint": "Determines cost centre"},
        {"key": "model", "label": "Model", "type": "text", "required": True, "validation": "not_empty", "edgeCaseAction": "flag_reviewer", "sourceHint": "Equipment section"},
        {"key": "serialNumber", "label": "Serial Number", "type": "text", "required": True, "validation": "not_empty", "edgeCaseAction": "flag_reviewer", "sourceHint": "Equipment section"},
        {"key": "jobCategory", "label": "Job Category", "type": "text", "required": True, "validation": "category_id", "edgeCaseAction": "flag_reviewer", "sourceHint": "Determines GL code"},
        {"key": "customerPurchaseDate", "label": "Customer Purchase Date", "type": "date", "required": True, "validation": "date_format", "edgeCaseAction": "flag_reviewer", "sourceHint": "Customer section"},
        {"key": "customerIssues", "label": "Customer Issues", "type": "text", "required": True, "validation": "not_empty", "edgeCaseAction": "flag_reviewer", "sourceHint": "Issues section"},
        {"key": "actionTaken", "label": "Action Taken", "type": "text", "required": True, "validation": "not_empty", "edgeCaseAction": "flag_reviewer", "sourceHint": "Action section"},
        {"key": "timeOn", "label": "Time On", "type": "time", "required": True, "validation": "not_empty", "edgeCaseAction": "flag_reviewer", "sourceHint": "Time section"},
        {"key": "timeOff", "label": "Time Off", "type": "time", "required": True, "validation": "not_empty", "edgeCaseAction": "flag_reviewer", "sourceHint": "Time section"},
        {"key": "customerSignature", "label": "Customer Signature", "type": "signature", "required": True, "validation": "present", "edgeCaseAction": "flag_reviewer", "sourceHint": "Signature area"},
        {"key": "technicianSignature", "label": "Technician Signature", "type": "signature", "required": True, "validation": "present", "edgeCaseAction": "flag_reviewer", "sourceHint": "Signature area"},
        {"key": "dateJobCompleted", "label": "Date of Job Completed", "type": "date", "required": False, "validation": "date_check", "edgeCaseAction": "flag_reviewer"},
    ]

    # --- D&I supporting: Installation Worksheet ---
    _INSTALL_FIELDS = [
        {"key": "caseNumber", "label": "Case Number", "type": "text", "required": True, "validation": "cross_ref_invoice", "edgeCaseAction": "flag_reviewer", "sourceHint": "Header (CAS)"},
        {"key": "dateJobBooked", "label": "Date Job Booked", "type": "date", "required": True, "validation": "date_format", "edgeCaseAction": "flag_reviewer", "sourceHint": "Header"},
        {"key": "jobMgr", "label": "Job MGR", "type": "text", "required": True, "validation": "approver_id", "edgeCaseAction": "flag_reviewer", "sourceHint": "Identifies approver"},
        {"key": "customerName", "label": "Customer Name", "type": "text", "required": True, "validation": "not_empty", "edgeCaseAction": "flag_reviewer", "sourceHint": "Customer section"},
        {"key": "customerAddress", "label": "Customer Address", "type": "text", "required": True, "validation": "not_empty", "edgeCaseAction": "flag_reviewer", "sourceHint": "Customer section"},
        {"key": "salesOrderNumber", "label": "Sales Order Number", "type": "text", "required": True, "validation": "branch_lookup", "edgeCaseAction": "flag_reviewer", "sourceHint": "Determines branch"},
        {"key": "jobCategory", "label": "Job Category", "type": "text", "required": True, "validation": "always_di", "edgeCaseAction": "flag_reviewer", "sourceHint": "Always 'Delivery & Install'"},
        {"key": "quoteAmount", "label": "Quote Amount", "type": "currency", "required": True, "validation": "match_invoice_subtotal", "edgeCaseAction": "flag_reviewer", "sourceHint": "Must match invoice sub-total"},
        {"key": "actionTaken", "label": "Action Taken", "type": "text", "required": True, "validation": "not_empty", "edgeCaseAction": "flag_reviewer", "sourceHint": "Action section"},
        {"key": "timeOn", "label": "Time On", "type": "time", "required": True, "validation": "not_empty", "edgeCaseAction": "flag_reviewer", "sourceHint": "Time section"},
        {"key": "timeOff", "label": "Time Off", "type": "time", "required": True, "validation": "not_empty", "edgeCaseAction": "flag_reviewer", "sourceHint": "Time section"},
        {"key": "customerSignature", "label": "Customer Signature", "type": "signature", "required": True, "validation": "present", "edgeCaseAction": "flag_reviewer", "sourceHint": "Signature area"},
        {"key": "technicianSignature", "label": "Technician Signature", "type": "signature", "required": True, "validation": "present", "edgeCaseAction": "flag_reviewer", "sourceHint": "Signature area"},
        {"key": "dateJobCompleted", "label": "Date Job Completed", "type": "date", "required": True, "validation": "date_format", "edgeCaseAction": "flag_reviewer", "sourceHint": "Footer"},
    ]

    # --- Freight-specific invoice fields (extend _INV_FIELDS with 9 freight data points) ---
    _FREIGHT_INV_FIELDS = _INV_FIELDS + [
        {"key": "consignor", "label": "Consignor", "type": "text", "required": True, "validation": "not_empty", "edgeCaseAction": "flag_reviewer", "sourceHint": "Shipment details"},
        {"key": "consignee", "label": "Consignee", "type": "text", "required": True, "validation": "entity_id", "edgeCaseAction": "flag_reviewer", "sourceHint": "Shipment details — used for entity ID"},
        {"key": "goodsDescription", "label": "Goods Description", "type": "text", "required": True, "validation": "category_id", "edgeCaseAction": "flag_reviewer", "sourceHint": "Identifies Finished Goods vs Spare Parts"},
        {"key": "importCustomsBroker", "label": "Import Customs Broker", "type": "text", "required": False, "validation": "sea_air_indicator", "edgeCaseAction": "flag_reviewer", "sourceHint": "If 'MAINFREIGHT AIR & OCEAN' → Sea"},
        {"key": "origin", "label": "Origin", "type": "text", "required": True, "validation": "rate_card_lookup", "edgeCaseAction": "flag_reviewer", "sourceHint": "Shipment origin city/port"},
        {"key": "destination", "label": "Destination", "type": "text", "required": True, "validation": "rate_card_lookup", "edgeCaseAction": "flag_reviewer", "sourceHint": "Shipment destination city/port"},
        {"key": "containerNumber", "label": "Container Number", "type": "text", "required": False, "validation": "sea_only", "edgeCaseAction": "flag_reviewer", "sourceHint": "Sea invoice only — presence indicates Sea"},
        {"key": "containerType", "label": "Container Type", "type": "text", "required": False, "validation": "rate_card_lookup", "edgeCaseAction": "flag_reviewer", "sourceHint": "e.g. 40 High Cube — Sea invoice only"},
        {"key": "flightDetails", "label": "Flight Details", "type": "text", "required": False, "validation": "air_only", "edgeCaseAction": "flag_reviewer", "sourceHint": "Flight Number & Date — Air invoice only"},
    ]

    # --- Freight supporting: Commercial Invoice ---
    _COMMERCIAL_INV_FIELDS = [
        {"key": "commercialInvoiceNumber", "label": "Commercial Invoice Number", "type": "text", "required": True, "validation": "required", "edgeCaseAction": "flag_reviewer"},
        {"key": "totalValue", "label": "Total Value", "type": "number", "required": True, "validation": "required", "edgeCaseAction": "flag_reviewer"},
    ]

    # --- Validation rules ---
    _COMMON_RULES = [
        {"ruleId": "MATH_CHECK", "ruleName": "Math Verification", "condition": "grandTotal == subTotal + taxAmount", "severity": "ERROR", "action": "flag_reviewer"},
        {"ruleId": "DUPLICATE", "ruleName": "Duplicate Invoice Check", "condition": "invoiceNumber + vendorName unique within 90 days", "severity": "ERROR", "action": "flag_reviewer"},
        {"ruleId": "VENDOR_MATCH", "ruleName": "Vendor Master Match", "condition": "vendorName matches vendor master record", "severity": "ERROR", "action": "flag_reviewer"},
        {"ruleId": "ENTITY_CHECK", "ruleName": "Entity Identification", "condition": "billTo maps to AU or NZ entity", "severity": "ERROR", "action": "flag_reviewer"},
        {"ruleId": "CURRENCY_CHECK", "ruleName": "Currency Match", "condition": "currency matches entity (AUD=AU, NZD=NZ)", "severity": "ERROR", "action": "flag_reviewer"},
    ]
    _CONTRACTOR_RULES = _COMMON_RULES + [
        {"ruleId": "CROSS_REF", "ruleName": "Worksheet Cross-Reference", "condition": "attachmentReference matches worksheet caseNumber", "severity": "ERROR", "action": "flag_reviewer"},
    ]
    _DI_RULES = _CONTRACTOR_RULES + [
        {"ruleId": "QUOTE_MATCH", "ruleName": "Quote Amount Match", "condition": "worksheet quoteAmount matches invoice subTotal", "severity": "ERROR", "action": "flag_reviewer"},
    ]

    configs = [
        ("SUBCONTRACTOR", ["Invoice", "Contractor Worksheet / Service Job Sheet / Work Order"], "GL-SUBCON-WAR",
         _INV_FIELDS, {"Work Order": _WORK_ORDER_FIELDS, "Contractor Worksheet": _WORKSHEET_FIELDS}, _CONTRACTOR_RULES),
        ("RUST_SUBCONTRACTOR", ["Invoice", "Contractor Worksheet / Service Job Sheet / Work Order"], "GL-SUBCON-CHG",
         _INV_FIELDS, {"Work Order": _WORK_ORDER_FIELDS, "Contractor Worksheet": _WORKSHEET_FIELDS}, _CONTRACTOR_RULES),
        ("DELIVERY_INSTALLATION", ["Invoice", "Installation Worksheet"], "GL-DI",
         _INV_FIELDS, {"Installation Worksheet": _INSTALL_FIELDS}, _DI_RULES),
        ("FREIGHT_FINISHED_GOODS", ["Invoice", "Commercial Invoice"], "GL-FRT-FG",
         _FREIGHT_INV_FIELDS, {"Commercial Invoice": _COMMERCIAL_INV_FIELDS}, _COMMON_RULES),
        ("FREIGHT_SPARE_PARTS", ["Invoice", "Commercial Invoice"], "GL-FRT-SP",
         _FREIGHT_INV_FIELDS, {"Commercial Invoice": _COMMERCIAL_INV_FIELDS}, _COMMON_RULES),
        ("FREIGHT_ADDITIONAL_CHARGES", ["Invoice"], "GL-FRT-ADD",
         _FREIGHT_INV_FIELDS, {}, _COMMON_RULES),
    ]
    for name, docs, gl, inv_f, sup_f, val_r in configs:
        db.add(InvoiceCategoryConfig(
            name=name, required_docs=docs, gl_account=gl,
            invoice_fields=inv_f, supporting_fields=sup_f, validation_rules=val_r,
        ))


# ---------------------------------------------------------------------------
# Approval Sequences (matching categories)
# ---------------------------------------------------------------------------
def _seed_approval_sequences(db: Session):
    seqs = [
        ("SUBCONTRACTOR", "Subcontractor Approval", [
            {"stepNumber": 1, "approverRole": "L1 Approver", "approverName": "Lisa Cubela", "approverId": "approver-lisa"},
            {"stepNumber": 2, "approverRole": "L2 Approver", "approverName": "Haran Ainkharan", "approverId": "approver-haran"},
        ]),
        ("RUST_SUBCONTRACTOR", "Rust Subcontractor Approval", [
            {"stepNumber": 1, "approverRole": "L1 Approver", "approverName": "Lisa Cubela", "approverId": "approver-lisa"},
            {"stepNumber": 2, "approverRole": "L2 Approver", "approverName": "Haran Ainkharan", "approverId": "approver-haran"},
        ]),
        ("DELIVERY_INSTALLATION", "D&I Approval", [
            {"stepNumber": 1, "approverRole": "L1 Approver", "approverName": "Jai Prasad", "approverId": "approver-jai"},
            {"stepNumber": 2, "approverRole": "L2 Approver", "approverName": "Haran Ainkharan", "approverId": "approver-haran"},
        ]),
        ("FREIGHT_FINISHED_GOODS", "Freight FG Approval", [
            {"stepNumber": 1, "approverRole": "L1 Approver", "approverName": "Vinay Nirooban", "approverId": "approver-vinay"},
            {"stepNumber": 2, "approverRole": "L2 Approver", "approverName": "Haran Ainkharan", "approverId": "approver-haran"},
        ]),
        ("FREIGHT_SPARE_PARTS", "Freight SP Approval", [
            {"stepNumber": 1, "approverRole": "L1 Approver", "approverName": "Ken Mori", "approverId": "approver-ken"},
            {"stepNumber": 2, "approverRole": "L2 Approver", "approverName": "Haran Ainkharan", "approverId": "approver-haran"},
        ]),
        ("FREIGHT_ADDITIONAL_CHARGES", "Freight Additional Approval", [
            {"stepNumber": 1, "approverRole": "L1 Approver", "approverName": "Sam Forbes", "approverId": "approver-sam"},
            {"stepNumber": 2, "approverRole": "L2 Approver", "approverName": "Haran Ainkharan", "approverId": "approver-haran"},
        ]),
    ]
    for inv_type, name, steps in seqs:
        db.add(ApprovalSequenceMaster(invoice_type=inv_type, name=name, steps=steps))


# ---------------------------------------------------------------------------
# Rate Cards
# ---------------------------------------------------------------------------
def _seed_freight_rate_cards(db: Session):
    db.add_all([
        FreightRateCard(origin="Shanghai", destination="Sydney", container_type="20ft", rate=2800.0, currency="USD", vendor_id="VND-MAINFREIGHT"),
        FreightRateCard(origin="Shanghai", destination="Sydney", container_type="40ft", rate=4200.0, currency="USD", vendor_id="VND-MAINFREIGHT"),
        FreightRateCard(origin="Shanghai", destination="Auckland", container_type="20ft", rate=3100.0, currency="USD", vendor_id="VND-MAINFREIGHT"),
        FreightRateCard(origin="Ningbo", destination="Sydney", container_type="40ft HC", rate=4500.0, currency="USD", vendor_id="VND-MAINFREIGHT"),
    ])


def _seed_service_rate_cards(db: Session):
    db.add_all([
        ServiceRateCard(service="Standard Service Call - Warranty", rate=165.0, currency="AUD", vendor_id="VND-REVO"),
        ServiceRateCard(service="Standard Service Call - Chargeable", rate=195.0, currency="AUD", vendor_id="VND-REVO"),
        ServiceRateCard(service="Delivery & Installation - Standard", rate=220.0, currency="AUD", vendor_id="VND-DI-01"),
        ServiceRateCard(service="Delivery & Installation - Premium", rate=350.0, currency="AUD", vendor_id="VND-DI-01"),
    ])


def _seed_agreement_masters(db: Session):
    db.add_all([
        AgreementMaster(vendor_id="VND-REVO", vendor_name="RevoFit Pty Ltd", agreement_number="AGR-REVO-2024",
                        status="Active", start_date="2024-01-01", end_date="2026-12-31"),
        AgreementMaster(vendor_id="VND-MAINFREIGHT", vendor_name="Mainfreight Air & Ocean", agreement_number="AGR-MF-2024",
                        status="Active", start_date="2024-01-01", end_date="2026-12-31"),
    ])


# ---------------------------------------------------------------------------
# Prompt Templates (5 AI steps — real, meaningful prompts from Process Design)
# ---------------------------------------------------------------------------
def _seed_prompt_templates(db: Session):
    templates = [
        # --- Step 1: Classify ---
        PromptTemplate(
            step_name="classify",
            display_name="Email Classification",
            technical_prompt="""# Email Classification Agent

You are an AP invoice processing agent for Johnson Health Tech Australia. Your task is to classify incoming emails as either INVOICE or NON_INVOICE.

{{BUSINESS_RULES}}

## Output
Output only classification and a brief reasoning sentence for audit.

Read email.json in this workspace for the email content and attachments/ for attachment content.""",
            business_rules="""## Classification Rules

Analyze THREE signals and combine them:

### Signal 1: Sender Reputation
- Known vendor email domains (e.g., accounts@, finance@, invoices@) = strong invoice indicator
- Internal JHTA emails = likely non-invoice
- Payment reminder emails = NON_INVOICE

### Signal 2: Email Body Keywords
Invoice indicators: "invoice attached", "invoice for submission", "please find attached invoice", "attached invoice", "please process invoice"
Non-invoice indicators: "payment reminder", "overdue payment", "statement of account", "meeting", "follow up"

### Signal 3: Attachment Content
- If attachment is present AND contains keywords "Tax Invoice" or "Invoice" AND email body does NOT indicate payment reminder -> INVOICE
- No attachments or only images/signatures -> NON_INVOICE

## Edge Case Handling

1. **Excel Format Invoice**: If the attachment is an Excel file (.xlsx, .xls, .csv), still classify as INVOICE if it contains invoice-like content (vendor name, amounts, line items). Do not reject based on file format alone.

2. **Handwritten Invoice**: If the document appears handwritten or scanned with poor quality, attempt classification. If content is unreadable, classify as AMBIGUOUS with low confidence.

3. **Unreadable Document**: If the document is completely unreadable (blank pages, corrupted, heavily redacted), classify as NON_INVOICE with a note in reasoning explaining the document is unreadable.""",
            output_schema={
                "type": "object",
                "properties": {
                    "classification": {"type": "string", "enum": ["INVOICE", "NON_INVOICE", "AMBIGUOUS"]},
                    "reasoning": {"type": "string"}
                },
                "required": ["classification", "reasoning"]
            },
        ),
        # --- Step 2: Categorize ---
        PromptTemplate(
            step_name="categorize",
            display_name="Invoice Categorization & Entity ID",
            technical_prompt="""# Invoice Categorization, Entity ID & Document Verification Agent

You are an AP invoice processing agent for Johnson Health Tech Australia. Classify the invoice into a category, identify the billing entity, and verify which supporting documents are present.

{{BUSINESS_RULES}}

## Output
Return a JSON object with category, entity, poType, freightType, vendorMatch, documents, reasoning.

## Efficiency Protocol — follow this file-reading order exactly
1. Read results/classify.json — it contains the classify agent's analysis of sender reputation, email body, and attachment content.
2. Read email.json for sender/subject context.
3. Read master-data/vendors.json for vendor matching against sender name/domain.
4. At this point, attempt category determination from: classify signals, email subject (job refs like JAU/CNR/CAS, vendor names, keywords like "freight", "delivery"), and vendor match.
5. Only open files in attachments/ if steps 1-4 are insufficient — i.e., email subject is generic, no job references found, vendor not matched, and classify attachment analysis doesn't identify the document type clearly enough to determine category.
6. After determining category, check attachment FILENAMES first — the document splitter names fragments like {stem}_doc1_invoice.pdf, {stem}_doc2_job_sheet.pdf, {stem}_doc3_supporting.pdf. Match filenames against required document types. Only read full PDF content if filenames are ambiguous.""",
            business_rules="""## Categories (Phase 1)

### SUBCONTRACTOR
- Vendor "RevoFit Pty Ltd ATF The NewFit Unit Trust" -> always Subcontractor/Rust
- Job sheet references starting with "JAU" or "CNR" or "Work Order"
- Keywords: "labour charges", "repair", "warranty repairs"
- Email reference: service@jhta.com.au
- Sub-type: Job Category = "Warranty Repair" AND Warranty Status = "Full Warranty"

### RUST_SUBCONTRACTOR
- Same vendor signals as Subcontractor
- Sub-type: Job Category = "Chargeable Repairs" AND Warranty Status = "Chargeable repairs"

### DELIVERY_INSTALLATION
- Job sheet references starting with "CAS"
- Keywords: "Delivery", "Installation", "Delivery and Installation", "D&I"
- Email reference: dni@jhta.com.au
- Installation Worksheet attached

### FREIGHT_FINISHED_GOODS
- Goods Description mentions Equipment/Finished Goods (NOT "Spare Parts")
- Consignor/Consignee present, container/shipping details
- Sea: "Ocean Bill of Lading", Container Number, Vendor "MAINFREIGHT AIR & OCEAN PTY LTD"
- Air: Flight Number & Date

### FREIGHT_SPARE_PARTS
- Goods Description contains "Spare Parts" or "Parts"
- Same shipping indicators as Freight FG

### FREIGHT_ADDITIONAL_CHARGES
- Charges include destination, handling, documentation, clearance, non-freight components
- Default when freight indicators exist but no FG/SP classification

## Entity Identification (AU / NZ)
1. Bill To section: "JOHNSON HEALTH TECH. AUSTRALIA PTY LTD" -> AU; "JOHNSON HEALTH TECH NEW ZEALAND LTD" -> NZ
2. Entity identifiers: ABN/ACN present -> AU
3. Supporting documents: look for entity name

## PO Type
- Determine if PO or NON_PO based on presence of Purchase Order reference

## Freight Type
- Set freightType to "SEA" or "AIR" for freight categories only (FREIGHT_FINISHED_GOODS, FREIGHT_SPARE_PARTS, FREIGHT_ADDITIONAL_CHARGES).
- SEA: Container Number/Type present, Import Customs Broker contains "MAINFREIGHT AIR & OCEAN", Ocean Bill of Lading.
- AIR: Flight Details present, no container details.
- Default to "AIR" if neither indicator is clearly present.
- Set to null for non-freight categories.

## Vendor Matching
- Compare sender/invoice vendor name against vendors.json in master-data/
- Return best match with vendorId, vendorName, vendorNumber, contractNumber, and contractStatus
- If no match found, set vendorId and vendorName to empty strings, contractStatus to "NONE"

## Classification Priority
1. Vendor-based identification (highest priority)
2. Invoice reference numbers (JAU/CNR/CAS)
3. Description keywords

## Document Verification

After determining category, identify which documents are present in the attachments directory.

### Mandatory Documents Matrix
| Category | Required Documents |
|----------|-------------------|
| SUBCONTRACTOR | Invoice + Contractor Worksheet / Service Job Sheet / Work Order |
| RUST_SUBCONTRACTOR | Invoice + Contractor Worksheet / Service Job Sheet / Work Order |
| DELIVERY_INSTALLATION | Invoice + Installation Worksheet |
| FREIGHT_FINISHED_GOODS | Invoice + Commercial Invoice |
| FREIGHT_SPARE_PARTS | Invoice + Commercial Invoice |
| FREIGHT_ADDITIONAL_CHARGES | Invoice only |

For each expected document type for this category (Invoice + supporting docs from FIELD_LIST.md), report whether it is PRESENT or MISSING.
For PRESENT documents, include the filename. For MISSING documents, set file to null.

### Document Type Identification
- Invoice: contains "Tax Invoice", "Invoice Number", amounts
- Contractor Worksheet: contains "JAU"/"CNR" reference, job details, branch code
- Service Job Sheet: contains service details, technician info
- Work Order: contains work order reference, task descriptions
- Installation Worksheet: contains "CAS" reference, delivery/installation details
- Commercial Invoice: contains shipment details, goods description, origin/destination""",
            output_schema={
                "type": "object",
                "properties": {
                    "category": {"type": "string", "enum": ["SUBCONTRACTOR", "RUST_SUBCONTRACTOR", "DELIVERY_INSTALLATION", "FREIGHT_FINISHED_GOODS", "FREIGHT_SPARE_PARTS", "FREIGHT_ADDITIONAL_CHARGES"]},
                    "entity": {"type": "string", "enum": ["AU", "NZ"]},
                    "poType": {"type": "string", "enum": ["PO", "NON_PO"]},
                    "freightType": {"type": "string", "enum": ["SEA", "AIR"], "nullable": True},
                    "vendorMatch": {
                        "type": "object",
                        "properties": {
                            "vendorId": {"type": "string"},
                            "vendorName": {"type": "string"},
                            "vendorNumber": {"type": "string", "description": "SAP vendor number from vendors.json"},
                            "contractNumber": {"type": "string", "description": "Active contract number from vendors.json"},
                            "contractStatus": {"type": "string", "enum": ["ACTIVE", "EXPIRED", "NONE"]}
                        }
                    },
                    "documents": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "type": {"type": "string"},
                                "file": {"type": "string"},
                                "status": {"type": "string", "enum": ["PRESENT", "MISSING"]}
                            },
                            "required": ["type", "status"]
                        }
                    },
                    "reasoning": {"type": "string"}
                },
                "required": ["category", "entity", "poType", "vendorMatch", "documents", "reasoning"]
            },
        ),
        # --- Step 3: Verify Docs (INACTIVE — absorbed into categorize) ---
        PromptTemplate(
            step_name="verify_docs",
            display_name="Supporting Document Verification",
            is_active=False,
            technical_prompt="""# Supporting Document Verification Agent

You are an AP invoice processing agent for Johnson Health Tech Australia. Verify that all mandatory supporting documents are present for the identified invoice category.

{{BUSINESS_RULES}}

## Output
Return a JSON object with verified, presentDocs, missingDocs, confidence, details.

## Efficiency Protocol — follow this file-reading order exactly
1. Read results/categorize.json for the identified category.
2. Read master-data/category-config.json for required documents.
3. Check attachment FILENAMES first — the document splitter names fragments like {stem}_doc1_invoice.pdf, {stem}_doc2_job_sheet.pdf, {stem}_doc3_supporting.pdf. Match filenames against required document types.
4. Only read full PDF content if filenames are ambiguous (e.g., original unsplit filenames) or if you suspect the splitter misclassified a document.""",
            business_rules="""## Mandatory Documents Matrix

| Category | Required Documents |
|----------|-------------------|
| SUBCONTRACTOR | Invoice + Contractor Worksheet / Service Job Sheet / Work Order |
| RUST_SUBCONTRACTOR | Invoice + Contractor Worksheet / Service Job Sheet / Work Order |
| DELIVERY_INSTALLATION | Invoice + Installation Worksheet |
| FREIGHT_FINISHED_GOODS | Invoice + Commercial Invoice |
| FREIGHT_SPARE_PARTS | Invoice + Commercial Invoice |
| FREIGHT_ADDITIONAL_CHARGES | Invoice only |

## Verification Process
1. Read master-data/category-config.json for the category's required documents
2. Check each attachment in attachments/ — read content to determine document type
3. For each required document, determine if it is present and valid
4. Flag missing documents

## Document Type Identification
- Invoice: contains "Tax Invoice", "Invoice Number", amounts
- Contractor Worksheet: contains "JAU"/"CNR" reference, job details, branch code
- Service Job Sheet: contains service details, technician info
- Work Order: contains work order reference, task descriptions
- Installation Worksheet: contains "CAS" reference, delivery/installation details
- Commercial Invoice: contains shipment details, goods description, origin/destination""",
            output_schema={
                "type": "object",
                "properties": {
                    "verified": {"type": "boolean"},
                    "presentDocs": {"type": "array", "items": {"type": "string"}},
                    "missingDocs": {"type": "array", "items": {"type": "string"}},
                    "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                    "details": {"type": "array", "items": {
                        "type": "object",
                        "properties": {
                            "documentType": {"type": "string"},
                            "fileName": {"type": "string"},
                            "status": {"type": "string", "enum": ["PRESENT", "MISSING"]},
                            "notes": {"type": "string"}
                        }
                    }}
                },
                "required": ["verified", "presentDocs", "missingDocs", "confidence"]
            },
        ),
        # --- Step 4: Extract ---
        PromptTemplate(
            step_name="extract",
            display_name="Data Extraction",
            technical_prompt="""# Data Extraction Agent

You are an AP invoice processing agent for Johnson Health Tech Australia. Extract all required data points from the invoice and supporting documents.

{{BUSINESS_RULES}}

Read attachments/ for invoice and supporting document content.
Read results/categorize.json for category context.""",
            business_rules="""## Extraction Instructions

**Read FIELD_LIST.md for the specific data points to extract for this invoice category.** It contains the complete field definitions, types, and source hints for both invoice and supporting documents.

## Reading Order
1. Read results/categorize.json for category and entity.
2. Read FIELD_LIST.md for the exact fields to extract.
3. Read each attachment in attachments/ — identify which is the invoice vs supporting docs.
4. Extract all fields listed in FIELD_LIST.md from the appropriate document.

## Output Structure
Return a flat `fields` array. For each field, output {doc, key, text, value, page, file} where:
- `text` is the exact text as it appears on the document (for OCR matching)
- `value` is the normalized value (ISO dates like 2026-03-17, cleaned numbers like 109.09, canonical formats)
- `file` is the filename in the attachments directory
- `page` is the page number within that file (starting from 1)

The `doc` value MUST be one of the document types listed in FIELD_LIST.md. The `key` MUST be one of the field keys defined for that document type.

Also return `lineItems` as an array of line item objects from the invoice.

## GL Code Derivation
- Subcontractor Warranty -> 614100
- Subcontractor Chargeable (Rust) -> 614200
- D&I -> 615100
- Freight FG -> 616100, SP -> 616200, Additional -> 616300

## Cost Centre Derivation
- Subcontractor/D&I: from Branch Code on job sheet (Home/Commercial/E-Commerce)
- RevoFit vendor: always Commercial
- Freight: always Commercial

## Edge Case Handling

1. **Entity Not Clearly Mentioned**: If the entity (AU vs NZ) is not explicitly stated, determine from: (a) Bill To address — look for Australian vs New Zealand addresses, (b) Currency — AUD implies AU, NZD implies NZ, (c) ABN format implies AU, NZBN implies NZ. If still unclear, set entity field value to null and the text to "UNCLEAR".

2. **Multiple Entity Names on Invoice**: If the invoice mentions both Australian and New Zealand entities (e.g., both ABN and NZBN), use the currency as the tiebreaker. AUD = AU entity, NZD = NZ entity. If currency is also ambiguous, set value to null.

3. **Handwritten Fields**: For handwritten text, extract your best reading. If a field is illegible, set value to null and text to "ILLEGIBLE".

4. **Confusing/Unstructured Description**: If the description field is a long paragraph rather than structured line items, summarize the key service/product in the value field. Keep the full original text in the text field.

5. **Missing Unit Price or Quantity**: If unit price or quantity is not explicitly stated but can be inferred (e.g., only one line item and total is given), infer the value. If truly missing, set value to null.

6. **Date Formats**: Normalize all dates to ISO format (YYYY-MM-DD) in the value field. Keep the original format in the text field (e.g., text="17th March 2026", value="2026-03-17").""",
            output_schema={
                "type": "object",
                "properties": {
                    "fields": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "doc": {"type": "string"},
                                "key": {"type": "string"},
                                "text": {"type": "string"},
                                "value": {},
                                "page": {"type": "integer"},
                                "file": {"type": "string"}
                            },
                            "required": ["doc", "key"]
                        }
                    },
                    "lineItems": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "line": {"type": "integer"},
                                "description": {"type": "string"},
                                "quantity": {"type": "number"},
                                "unitPrice": {"type": "number"},
                                "total": {"type": "number"},
                                "tax": {"type": "number"}
                            }
                        }
                    }
                },
                "required": ["fields", "lineItems"]
            },
        ),
        # --- Step 5: Validate ---
        PromptTemplate(
            step_name="validate",
            display_name="Validation & Business Rules",
            technical_prompt="""# Validation & Business Rule Matching Agent

You are an AP invoice processing agent for Johnson Health Tech Australia. Validate extracted data against supporting documents, vendor master, rate cards, and business rules.

{{BUSINESS_RULES}}

## Rule Results
For each validation, return:
- ruleId: unique identifier for the rule
- ruleName: human-readable name (optional, include for clarity)
- status: PASS | FAIL | WARNING | INFO
- message: one-sentence explanation
- expectedValue, actualValue: include only for FAIL/WARNING rules
- fields: array of {doc, key} pairs you checked for this rule

Do NOT include overallStatus — it is computed by the system.

## Efficiency Protocol — follow these rules exactly
- Read ONLY results/extract.json for all extracted data. It contains a flat `fields` array (each entry: {doc, key, text, value, page, file}) and a `lineItems` array.
- Read master-data/ files (vendors.json, service-rate-cards.json, freight-rate-cards.json, approval-rules.json) for validation rules.
- Do NOT read files in attachments/. The extract step has already read and interpreted the source documents. All data you need is in extract.json.
- Keep output CONCISE: one-sentence messages per rule.""",
            business_rules="""## Validation Instructions

**Read FIELD_LIST.md for the specific validation rules defined for this invoice category.** Apply each rule listed in the Validation Rules section.

## Config-Driven Rules
Read FIELD_LIST.md for the validation rules defined for this category. For each rule listed:
- Evaluate the condition against the extracted data
- Output a result with the exact ruleId from FIELD_LIST.md
- For each rule, include a `fields` array listing the (doc, key) pairs you checked. Example: `"fields": [{"doc": "Invoice", "key": "grandTotal"}, {"doc": "Invoice", "key": "subTotal"}]`
- For PASS rules, omit expectedValue and actualValue. For FAIL/WARNING rules, include them.
- Do NOT include overallStatus — it is computed by the system.

## Reading extract.json — Flat Fields Format
Read results/extract.json — it contains a flat `fields` array where each entry has {doc, key, text, value, page, file}.
- Invoice fields have doc="Invoice". Supporting doc fields have doc="<document type name>" (e.g., "Contractor Worksheet").
- To find a specific field, filter by doc and key: e.g., find the field where doc="Invoice" and key="grandTotal".
- For cross-document matching, compare value fields across different doc types.
- Line items are in the `lineItems` array (unchanged).

## Reading Order
1. Read results/extract.json for all extracted data (fields array + lineItems).
2. Read FIELD_LIST.md for validation rules.
3. Read master-data/ files (vendors.json, service-rate-cards.json, freight-rate-cards.json, approval-rules.json).
4. Do NOT read attachments/ — all data is in extract.json.

## 4-Way Matching

### 1. Invoice <-> Supporting Documents
- SUBCONTRACTOR: attachmentReference (doc="Invoice", key="attachmentReference") must match worksheet caseNumber/workOrderNumber (doc="Contractor Worksheet").
- D&I: attachmentReference must match installation worksheet caseNumber. subTotal must match quoteAmount.
- FREIGHT: Rates on invoice must match freight rate card.

### 2. Invoice <-> Vendor Master
- vendorName and vendorABN (doc="Invoice") must match vendor master record
- bankDetails must match vendor master

### 3. Math & Tax Checks
- grandTotal must equal subTotal + taxAmount (all doc="Invoice" fields)
- Tax rate: 10% for AU entity, 15% for NZ entity

### 4. Entity & Currency
- billTo (doc="Invoice") must map to AU or NZ entity
- currency must match entity (AUD for AU, NZD for NZ)

### 5. Duplicate Check
- invoiceNumber + vendorName (doc="Invoice") must be unique within 90-day window

### 6. Rate Card Matching

#### Service Invoices (SUBCONTRACTOR, RUST_SUBCONTRACTOR)
- Compare extracted unitPrice (doc="Invoice", key="unitPrice") against `master-data/service-rate-cards.json` for the matched vendor. Find the rate card entry where vendorId matches and service type matches the description. If unitPrice != rate, report FAIL with expected rate vs actual.

#### Freight Invoices (FREIGHT_FINISHED_GOODS, FREIGHT_SPARE_PARTS)
- For Sea freight: compare line item rates against `master-data/freight-rate-cards.json` by origin + destination + container type. If rate doesn't match, report FAIL.
- For Freight: verify bankDetails (doc="Invoice", key="bankDetails") matches vendor master data.

### 7. Sea vs Air Classification
- Classify as Sea if: Import Customs Broker contains "MAINFREIGHT AIR & OCEAN" OR Container Number/Type present.
- Classify as Air if: Flight Details present.
- Default to Air if neither indicator is present.
- If unable to determine, flag to reviewer.

## D&I Category — Additional Matching Rules

1. **Quote Amount Match**: For DELIVERY_INSTALLATION cases, compare Invoice subTotal (doc="Invoice", key="subTotal") against Installation Worksheet quoteAmount (doc="Installation Worksheet", key="quoteAmount"). If they don't match, report FAIL with both values.

2. **Job MGR Identification**: The Installation Worksheet's "Job MGR" field identifies the approver. Flag if missing — this is required for approval routing.

3. **Sales Order Number → Branch**: For D&I, the Sales Order Number from the Installation Worksheet determines the Branch Code. If Sales Order Number is missing, flag as "Branch cannot be determined."

## Additional Validation Rules (All Categories)

1. **Invoice Date Recency**: Invoice date (doc="Invoice", key="invoiceDate") must be within 7 days after the Date of Job Completed (doc="Contractor Worksheet"/"Installation Worksheet", key="dateJobCompleted" or similar). If invoiceDate > jobDate + 7 days, flag as WARNING: "Invoice date is more than 7 days after job completion."

2. **Entity-Currency Consistency**:
   - AU entity → currency must be AUD (except Sea Freight which uses USD)
   - NZ entity → currency must be NZD
   - If mismatch, flag as FAIL.

3. **Math Verification**: grandTotal must equal subTotal + taxAmount. If mismatch, flag as FAIL with calculated vs stated values.

4. **Duplicate Invoice Check**: Flag if invoiceNumber + vendorName combination has been seen before (within 90-day window). Note: this requires checking against existing cases — if not possible in this step, flag as INFO: "Duplicate check requires database lookup."
""",
            output_schema={
                "type": "object",
                "properties": {
                    "results": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "ruleId": {"type": "string"},
                                "ruleName": {"type": "string"},
                                "status": {"type": "string", "enum": ["PASS", "FAIL", "WARNING", "INFO"]},
                                "message": {"type": "string"},
                                "expectedValue": {"type": "string"},
                                "actualValue": {"type": "string"},
                                "fields": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "doc": {"type": "string"},
                                            "key": {"type": "string"}
                                        },
                                        "required": ["doc", "key"]
                                    }
                                }
                            },
                            "required": ["ruleId", "status", "message"]
                        }
                    }
                },
                "required": ["results"]
            },
        ),
    ]
    db.add_all(templates)
