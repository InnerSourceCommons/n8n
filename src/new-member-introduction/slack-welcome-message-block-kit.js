// Edit the blocks array below to match Slack Block Kit. Copy the whole blocks array
// and paste into https://app.slack.com/block-kit-builder/ to preview.
// block_kit_builder_url in the output opens the builder with this payload.
const displayName = $input.first().json.new_user_display_name || 'there';
const blocks = [
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*Hey ${displayName}!*\n\nWelcome to the InnerSource Commons! It's so cool you're here! 🎉\n\nThis is a global community of practitioners, researchers, and curious minds all exploring how open collaboration works inside organizations.`
    }
  },
  { type: 'divider' },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: "👋 *Head over to <#C0867TAF63H|newcomers> and tell us a little about yourself, or choose how you'd like to get started:*"
    }
  },
  {
    type: 'actions',
    elements: [
      { type: 'button', text: { type: 'plain_text', text: '📖 Quick Start Guide', emoji: true }, url: 'https://innersourcecommons.org/community/quick-start-guide/' },
      { type: 'button', text: { type: 'plain_text', text: '📅 Join a Meeting', emoji: true }, url: 'https://innersourcecommons.org/community/calendar/' },
      { type: 'button', text: { type: 'plain_text', text: '🏢 Pattern Library', emoji: true }, url: 'https://patterns.innersourcecommons.org/' }
    ]
  },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '🌍 Join a Regional Community: <#C07MXDSG2P8|africa> <#C03M546NR16|japan>'
    }
  },
  { type: 'divider' },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '🔎 *Explore channels that match your interests:*\n\n• <#C2EFRTS6A|innersource-patterns> — practical patterns for making innersource work\n• <#C046MD5R5RT|local-community> — find or start a gathering near you\n• <#C04DT6NQX7G|ispo-working-group> — dive into standards and best practices'
    }
  },
  { type: 'divider' },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '💬 Looking for something else? Ask in <#C04PXKRN4|general>, and the community will be happy to help!'
    }
  }
];
const payload = { blocks };
const blockKitBuilderUrl = 'https://app.slack.com/block-kit-builder/T04PXKRM0#' + encodeURIComponent(JSON.stringify(payload));
return $input.all().map(item => ({
  json: {
    ...item.json,
    blocks,
    blocks_json: JSON.stringify(payload, null, 2),
    block_kit_builder_url: blockKitBuilderUrl
  }
}));

