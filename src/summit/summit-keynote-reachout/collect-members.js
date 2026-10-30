const staticData = $getWorkflowStaticData('global');
const response = $input.first().json;
if (response.members) {
  staticData.allMembers.push(...response.members);
}
const nextCursor = response.response_metadata?.next_cursor || '';
return [{ json: { cursor: nextCursor } }];
