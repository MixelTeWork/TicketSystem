"""v4

Revision ID: 7e03beaed783
Revises: 7215095d07c4
Create Date: 2024-07-26 15:40:31.626719

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7e03beaed783'
down_revision: Union[str, None] = '7215095d07c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('Font', schema=None) as batch_op:
        batch_op.create_unique_constraint(batch_op.f('uq_Font_name'), ['name'])

    with op.batch_alter_table('Ticket', schema=None) as batch_op:
        batch_op.add_column(sa.Column('authOnPltf', sa.Boolean(), server_default='0', nullable=False))

    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('Ticket', schema=None) as batch_op:
        batch_op.drop_column('authOnPltf')

    with op.batch_alter_table('Font', schema=None) as batch_op:
        batch_op.drop_constraint(batch_op.f('uq_Font_name'), type_='unique')

    # ### end Alembic commands ###