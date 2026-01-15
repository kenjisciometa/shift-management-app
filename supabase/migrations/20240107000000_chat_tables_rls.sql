-- Enable RLS on chat tables
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (to prevent conflicts)
DROP POLICY IF EXISTS "Users can view chat rooms they are part of" ON chat_rooms;
DROP POLICY IF EXISTS "Users can create chat rooms in their organization" ON chat_rooms;
DROP POLICY IF EXISTS "Users can update chat rooms they own" ON chat_rooms;

DROP POLICY IF EXISTS "Users can view their own participations" ON chat_participants;
DROP POLICY IF EXISTS "Users can create participations for rooms they create" ON chat_participants;
DROP POLICY IF EXISTS "Users can update their own participation" ON chat_participants;

DROP POLICY IF EXISTS "Users can view messages in their chat rooms" ON chat_messages;
DROP POLICY IF EXISTS "Users can send messages to their chat rooms" ON chat_messages;

-- chat_rooms policies
CREATE POLICY "Users can view chat rooms they are part of"
ON chat_rooms FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM chat_participants
    WHERE chat_participants.room_id = chat_rooms.id
    AND chat_participants.user_id = auth.uid()
  )
  OR
  created_by = auth.uid()
);

CREATE POLICY "Users can create chat rooms in their organization"
ON chat_rooms FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can update chat rooms they own"
ON chat_rooms FOR UPDATE
USING (created_by = auth.uid());

-- chat_participants policies
CREATE POLICY "Users can view their own participations"
ON chat_participants FOR SELECT
USING (
  user_id = auth.uid()
  OR
  room_id IN (
    SELECT room_id FROM chat_participants WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create participations for rooms they create"
ON chat_participants FOR INSERT
WITH CHECK (
  room_id IN (
    SELECT id FROM chat_rooms WHERE created_by = auth.uid()
  )
  OR
  user_id = auth.uid()
);

CREATE POLICY "Users can update their own participation"
ON chat_participants FOR UPDATE
USING (user_id = auth.uid());

-- chat_messages policies
CREATE POLICY "Users can view messages in their chat rooms"
ON chat_messages FOR SELECT
USING (
  room_id IN (
    SELECT room_id FROM chat_participants WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can send messages to their chat rooms"
ON chat_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND
  room_id IN (
    SELECT room_id FROM chat_participants WHERE user_id = auth.uid()
  )
);
