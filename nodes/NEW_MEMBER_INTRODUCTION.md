## Example Response

When a new user joins the Slack workspace, the trigger receives a payload like this:

```json
[
  {
    "type": "team_join",
    "user": {
      "id": "U1234ABCD",
      "name": "jane.smith",
      "is_bot": false,
      "updated": 1234567890,
      "is_app_user": false,
      "team_id": "T12345678",
      "deleted": false,
      "color": "9f69e7",
      "is_email_confirmed": true,
      "real_name": "Jane Smith",
      "tz": "America/New_York",
      "tz_label": "Eastern Time",
      "tz_offset": -18000,
      "is_admin": false,
      "is_owner": false,
      "is_primary_owner": false,
      "is_restricted": false,
      "is_ultra_restricted": false,
      "who_can_share_contact_card": "EVERYONE",
      "profile": {
        "real_name": "Jane Smith",
        "display_name": "Jane",
        "avatar_hash": "g1234567890a",
        "real_name_normalized": "Jane Smith",
        "display_name_normalized": "Jane",
        "image_24": "https://secure.gravatar.com/avatar/abc123def456.jpg?s=24&d=https%3A%2F%2Fa.slack-edge.com%2Fdf10d%2Fimg%2Favatars%2Fava_0001-24.png",
        "image_32": "https://secure.gravatar.com/avatar/abc123def456.jpg?s=32&d=https%3A%2F%2Fa.slack-edge.com%2Fdf10d%2Fimg%2Favatars%2Fava_0001-32.png",
        "image_48": "https://secure.gravatar.com/avatar/abc123def456.jpg?s=48&d=https%3A%2F%2Fa.slack-edge.com%2Fdf10d%2Fimg%2Favatars%2Fava_0001-48.png",
        "image_72": "https://secure.gravatar.com/avatar/abc123def456.jpg?s=72&d=https%3A%2F%2Fa.slack-edge.com%2Fdf10d%2Fimg%2Favatars%2Fava_0001-72.png",
        "image_192": "https://secure.gravatar.com/avatar/abc123def456.jpg?s=192&d=https%3A%2F%2Fa.slack-edge.com%2Fdf10d%2Fimg%2Favatars%2Fava_0001-192.png",
        "image_512": "https://secure.gravatar.com/avatar/abc123def456.jpg?s=512&d=https%3A%2F%2Fa.slack-edge.com%2Fdf10d%2Fimg%2Favatars%2Fava_0001-512.png",
        "first_name": "Jane",
        "last_name": "Smith",
        "team": "T12345678",
        "email": "jane.smith@example.com",
        "title": "",
        "phone": "",
        "skype": "",
        "fields": {},
        "status_text": "",
        "status_text_canonical": "",
        "status_emoji": "",
        "status_emoji_display_info": [],
        "status_expiration": 0
      },
      "presence": "away"
    },
    "cache_ts": 1234567890,
    "event_ts": "1234567890.054700"
  }
]
```

## How It Works

This n8n workflow automatically welcomes new members to the InnerSource Commons Slack workspace through a personalized group message. Here's the flow:

1. **Trigger**: The "New User Slack Trigger" node listens for `team_join` events from Slack, which fire whenever someone joins the workspace.

2. **Normalize Data**: The "Edit Fields" node extracts and standardizes the new user's display name and ID from the incoming payload, making it easier to reference in subsequent nodes.

3. **Create Group Conversation**: The "Open Slack Group Conversation" node uses the Slack API to open a multi-person direct message that includes the new user and three community ambassadors (identified by their user IDs).

4. **Send Welcome Message**: The "Start Group Chat" node posts a friendly welcome message to the group conversation. The message includes:
   - A personalized greeting using the new member's display name
   - Links to the Quick Start Guide
   - Suggestions for channels to join
   - An invitation to introduce themselves

The workflow ensures every new member receives a warm, consistent welcome and immediate access to community resources and support.