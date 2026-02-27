

## Plan: Streak Comparison Feature

### 1. Create Database Function for Friend Streaks

Create a new PostgreSQL function `get_friend_streaks(friend_ids uuid[])` that:
- Takes an array of friend user IDs
- Verifies each user is actually a friend (via `are_friends()` function)
- For each friend, finds their active challenge and calculates current/longest streaks
- Returns: `user_id`, `current_streak`, `longest_streak`
- Uses `SECURITY DEFINER` to bypass RLS safely

```sql
CREATE OR REPLACE FUNCTION get_friend_streaks(friend_ids uuid[])
RETURNS TABLE(
  user_id uuid,
  current_streak bigint,
  longest_streak bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
```

### 2. Create useFriendStreaks Hook

New hook `src/hooks/useFriendStreaks.ts` that:
- Takes a list of friend IDs from `useFriends`
- Calls the `get_friend_streaks` database function
- Returns streak data for all friends
- Includes loading and error states

### 3. Create FriendStreakComparison Component

New component `src/components/FriendStreakComparison.tsx` that displays:
- **Your streak** at the top with highlight styling
- **Friends' streaks** sorted by current streak (highest first)
- Visual comparison bars showing relative streak lengths
- Friend avatars and names
- Celebration/encouragement for friends beating your streak
- Empty state when no friends have active challenges

### 4. Add Streaks Tab to Friends Page

Update `src/pages/Friends.tsx` to:
- Add a 4th tab called "Streak Board" (or integrate into Friends tab)
- Show the `FriendStreakComparison` component
- Display user's own streak for comparison

### 5. Optional: Add Streak Comparison Card to Dashboard

Add a small "Friends Streaks" card on the Dashboard that shows:
- Top 3 friends by current streak
- Quick comparison to your own streak
- Link to full comparison on Friends page

---

### Visual Design

```
┌─────────────────────────────────────────┐
│  🔥 Streak Comparison                   │
├─────────────────────────────────────────┤
│  👤 You                    🔥 12 days   │
│  ████████████████████████  (Best: 15)   │
├─────────────────────────────────────────┤
│  👤 Sarah                  🔥 18 days   │
│  ██████████████████████████████ 🏆      │
│                                         │
│  👤 Mike                   🔥 8 days    │
│  ████████████████                       │
│                                         │
│  👤 Alex                   🔥 5 days    │
│  ██████████                             │
└─────────────────────────────────────────┘
```

### Files to Create/Modify

**Create:**
- Database migration for `get_friend_streaks` function
- `src/hooks/useFriendStreaks.ts`
- `src/components/FriendStreakComparison.tsx`

**Modify:**
- `src/pages/Friends.tsx` - Add Streaks tab

