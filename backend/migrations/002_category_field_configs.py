def up(conn):
    """Add invoice_fields, supporting_fields, validation_rules to InvoiceCategoryConfig."""
    # NOTE: PRAGMA table_info is SQLite-specific. For PostgreSQL, query information_schema.columns instead.
    cursor = conn.execute("PRAGMA table_info(invoice_category_configs)")
    existing = {row[1] for row in cursor.fetchall()}

    new_cols = [
        ("invoice_fields", "TEXT DEFAULT '[]'"),
        ("supporting_fields", "TEXT DEFAULT '{}'"),
        ("validation_rules", "TEXT DEFAULT '[]'"),
    ]

    for col_name, col_def in new_cols:
        if col_name not in existing:
            conn.execute(f"ALTER TABLE invoice_category_configs ADD COLUMN {col_name} {col_def}")
