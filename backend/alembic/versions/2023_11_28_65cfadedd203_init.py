"""init

Revision ID: 65cfadedd203
Revises: 
Create Date: 2023-11-28 22:59:39.749392

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '65cfadedd203'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('Event',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('deleted', sa.Boolean(), server_default='0', nullable=False),
    sa.Column('name', sa.String(length=64), nullable=False),
    sa.Column('date', sa.DateTime(), nullable=False),
    sa.Column('active', sa.Boolean(), server_default='1', nullable=False),
    sa.Column('lastTicketNumber', sa.Integer(), server_default='0', nullable=False),
    sa.Column('lastTypeNumber', sa.Integer(), server_default='0', nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_Event')),
    sa.UniqueConstraint('id', name=op.f('uq_Event_id'))
    )
    op.create_table('Operation',
    sa.Column('id', sa.String(length=32), nullable=False),
    sa.Column('name', sa.String(length=32), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_Operation')),
    sa.UniqueConstraint('id', name=op.f('uq_Operation_id'))
    )
    op.create_table('Role',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('deleted', sa.Boolean(), server_default='0', nullable=False),
    sa.Column('name', sa.String(length=32), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_Role')),
    sa.UniqueConstraint('id', name=op.f('uq_Role_id'))
    )
    op.create_table('Permission',
    sa.Column('roleId', sa.Integer(), nullable=False),
    sa.Column('operationId', sa.String(length=32), nullable=False),
    sa.ForeignKeyConstraint(['operationId'], ['Operation.id'], name=op.f('fk_Permission_operationId_Operation')),
    sa.ForeignKeyConstraint(['roleId'], ['Role.id'], name=op.f('fk_Permission_roleId_Role')),
    sa.PrimaryKeyConstraint('roleId', 'operationId', name=op.f('pk_Permission'))
    )
    op.create_table('User',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('deleted', sa.Boolean(), server_default='0', nullable=False),
    sa.Column('login', sa.String(length=64), nullable=False),
    sa.Column('name', sa.String(length=64), nullable=False),
    sa.Column('password', sa.String(length=128), nullable=False),
    sa.Column('roleId', sa.Integer(), nullable=False),
    sa.Column('bossId', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['bossId'], ['User.id'], name=op.f('fk_User_bossId_User')),
    sa.ForeignKeyConstraint(['roleId'], ['Role.id'], name=op.f('fk_User_roleId_Role')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_User')),
    sa.UniqueConstraint('id', name=op.f('uq_User_id'))
    )
    with op.batch_alter_table('User', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_User_login'), ['login'], unique=True)

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
    op.create_table('Log',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('date', sa.DateTime(), nullable=False),
    sa.Column('actionCode', sa.String(length=16), nullable=False),
    sa.Column('userId', sa.Integer(), nullable=False),
    sa.Column('userName', sa.String(length=64), nullable=False),
    sa.Column('tableName', sa.String(length=16), nullable=False),
    sa.Column('recordId', sa.Integer(), nullable=False),
    sa.Column('changes', sa.JSON(), nullable=False),
    sa.ForeignKeyConstraint(['userId'], ['User.id'], name=op.f('fk_Log_userId_User')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_Log')),
    sa.UniqueConstraint('id', name=op.f('uq_Log_id'))
    )
    op.create_table('PermissionAccess',
    sa.Column('userId', sa.Integer(), nullable=False),
    sa.Column('eventId', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['eventId'], ['Event.id'], name=op.f('fk_PermissionAccess_eventId_Event')),
    sa.ForeignKeyConstraint(['userId'], ['User.id'], name=op.f('fk_PermissionAccess_userId_User')),
    sa.PrimaryKeyConstraint('userId', 'eventId', name=op.f('pk_PermissionAccess'))
    )
    op.create_table('TicketType',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('deleted', sa.Boolean(), server_default='0', nullable=False),
    sa.Column('eventId', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=64), nullable=False),
    sa.Column('number', sa.Integer(), nullable=False),
    sa.Column('imageId', sa.Integer(), nullable=True),
    sa.Column('pattern', sa.JSON(), nullable=True),
    sa.ForeignKeyConstraint(['eventId'], ['Event.id'], name=op.f('fk_TicketType_eventId_Event')),
    sa.ForeignKeyConstraint(['imageId'], ['Image.id'], name=op.f('fk_TicketType_imageId_Image')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_TicketType')),
    sa.UniqueConstraint('id', name=op.f('uq_TicketType_id'))
    )
    op.create_table('Ticket',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('deleted', sa.Boolean(), server_default='0', nullable=False),
    sa.Column('createdDate', sa.DateTime(), nullable=False),
    sa.Column('createdById', sa.Integer(), nullable=False),
    sa.Column('eventId', sa.Integer(), nullable=False),
    sa.Column('typeId', sa.Integer(), nullable=False),
    sa.Column('code', sa.String(length=32), nullable=False),
    sa.Column('scanned', sa.Boolean(), server_default='0', nullable=False),
    sa.Column('updatedDate', sa.DateTime(), nullable=True),
    sa.Column('updatedById', sa.Integer(), nullable=True),
    sa.Column('scannedDate', sa.DateTime(), nullable=True),
    sa.Column('scannedById', sa.Integer(), nullable=True),
    sa.Column('personName', sa.String(length=256), nullable=True),
    sa.Column('personLink', sa.String(length=256), nullable=True),
    sa.Column('promocode', sa.String(length=64), nullable=True),
    sa.ForeignKeyConstraint(['createdById'], ['User.id'], name=op.f('fk_Ticket_createdById_User')),
    sa.ForeignKeyConstraint(['eventId'], ['Event.id'], name=op.f('fk_Ticket_eventId_Event')),
    sa.ForeignKeyConstraint(['scannedById'], ['User.id'], name=op.f('fk_Ticket_scannedById_User')),
    sa.ForeignKeyConstraint(['typeId'], ['TicketType.id'], name=op.f('fk_Ticket_typeId_TicketType')),
    sa.ForeignKeyConstraint(['updatedById'], ['User.id'], name=op.f('fk_Ticket_updatedById_User')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_Ticket')),
    sa.UniqueConstraint('code', name=op.f('uq_Ticket_code')),
    sa.UniqueConstraint('id', name=op.f('uq_Ticket_id'))
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('Ticket')
    op.drop_table('TicketType')
    op.drop_table('PermissionAccess')
    op.drop_table('Log')
    op.drop_table('Image')
    with op.batch_alter_table('User', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_User_login'))

    op.drop_table('User')
    op.drop_table('Permission')
    op.drop_table('Role')
    op.drop_table('Operation')
    op.drop_table('Event')
    # ### end Alembic commands ###
