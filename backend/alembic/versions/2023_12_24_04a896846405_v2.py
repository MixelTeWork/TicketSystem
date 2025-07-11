"""v2

Revision ID: 04a896846405
Revises: 65cfadedd203
Create Date: 2023-12-24 21:58:47.794496

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from sqlalchemy import orm
from bafser.data.role import Role


# revision identifiers, used by Alembic.
revision: str = '04a896846405'
down_revision: Union[str, None] = '65cfadedd203'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('Font',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('deleted', sa.Boolean(), server_default='0', nullable=False),
    sa.Column('name', sa.String(length=128), nullable=False),
    sa.Column('type', sa.String(length=16), nullable=False),
    sa.Column('creationDate', sa.DateTime(), nullable=False),
    sa.Column('deletionDate', sa.DateTime(), nullable=True),
    sa.Column('createdById', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['createdById'], ['User.id'], name=op.f('fk_Font_createdById_User')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_Font')),
    sa.UniqueConstraint('id', name=op.f('uq_Font_id'))
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('Font')
    # ### end Alembic commands ###
