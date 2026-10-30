const item = $input.first().json;
const d = item.utcDate;
const q = item.query;
const blocks = {
  blocks: [
    { type: 'section', text: { type: 'mrkdwn', text: `<!here> Reminder: InnerSource Working Group call happens ${d.dayofweekname} at ${q.time} UTC :tada:\n\nThis is an excellent meeting for newcomers looking to learn about InnerSource. All are welcome to join!` } },
    { type: 'divider' },
    { type: 'section', text: { type: 'mrkdwn', text: `*This meeting's topic:*\n\n${q.topic}` } },
    { type: 'divider' },
    { type: 'section', fields: [
      { type: 'mrkdwn', text: `:spiral_calendar_pad: *Date:*\n${d.dayofweekname}, ${d.monthname} ${d.ordinal}` },
      { type: 'mrkdwn', text: ':alarm_clock: *Time:*\nMultiple time zones below' }
    ] },
    { type: 'section', text: { type: 'mrkdwn', text: `*Time Zones:*\n${d.timeZonesText}` } },
    { type: 'divider' },
    { type: 'section', text: { type: 'mrkdwn', text: `:link: <${q.meeting_notes_url}>\n:link: <https://innersourcecommons.org/calendar/|InnerSource Commons Calendar>` } },
    { type: 'actions', elements: [ { type: 'button', text: { type: 'plain_text', text: 'Join Meeting', emoji: true }, url: 'https://us06web.zoom.us/j/84987611486?pwd=Biw6cc9UwWI6FrM51Ugox10sClIP6n.1', style: 'danger' } ] }
  ]
};
return [{ json: { ...item, blocks } }];
