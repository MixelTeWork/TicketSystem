"""v2

Revision ID: d632bc724288
Revises: b8a07f74589d
Create Date: 2023-11-28 20:13:31.273821

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd632bc724288'
down_revision: Union[str, None] = 'b8a07f74589d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('Image',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('deleted', sa.Boolean(), server_default='0', nullable=False),
    sa.Column('name', sa.String(length=128), nullable=False),
    sa.Column('type', sa.String(length=16), nullable=False),
    sa.Column('creationDate', sa.DateTime(), nullable=False),
    sa.Column('deletionDate', sa.DateTime(), nullable=True),
    sa.Column('createdById', sa.Integer(), nullable=False),
    sa.Column('accessEventId', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['accessEventId'], ['Event.id'], name=op.f('fk_Image_accessEventId_Event')),
    sa.ForeignKeyConstraint(['createdById'], ['User.id'], name=op.f('fk_Image_createdById_User')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_Image')),
    sa.UniqueConstraint('id', name=op.f('uq_Image_id'))
    )
    with op.batch_alter_table('TicketType', schema=None) as batch_op:
        batch_op.add_column(sa.Column('imageId', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('pattern', sa.JSON(), nullable=True))
        batch_op.create_foreign_key(batch_op.f('fk_TicketType_imageId_Image'), 'Image', ['imageId'], ['id'])

    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('TicketType', schema=None) as batch_op:
        batch_op.drop_constraint(batch_op.f('fk_TicketType_imageId_Image'), type_='foreignkey')
        batch_op.drop_column('pattern')
        batch_op.drop_column('imageId')

    op.drop_table('Image')
    # ### end Alembic commands ###
