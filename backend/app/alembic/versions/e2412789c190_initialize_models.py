"""Initialize models

Revision ID: e2412789c190
Revises:
Create Date: 2023-11-24 22:55:43.195942

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "e2412789c190"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # No tables to create - auth was removed
    pass


def downgrade():
    # Nothing to downgrade
    pass
