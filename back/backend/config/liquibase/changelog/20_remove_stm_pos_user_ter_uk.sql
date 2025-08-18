--changeset sitmun:19
-- Migration to remove STM_POS_USER_TER_UK unique constraint from STM_POST table
-- This constraint was on (POS_USERID, POS_TERID) columns

-- Remove the unique constraint
ALTER TABLE STM_POST DROP CONSTRAINT STM_POS_USER_TER_UK;

