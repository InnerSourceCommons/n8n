const staticData = $getWorkflowStaticData('global');
const allMembers = staticData.allMembers || [];
return [{ json: { members: allMembers } }];
