#!/bin/bash

# Display execution plan for an n8n workflow
# Usage: ./workflow-execution-plan.sh <workflow.json>

if [ $# -eq 0 ]; then
    echo "Usage: $0 <workflow.json>"
    exit 1
fi

if [ ! -f "$1" ]; then
    echo "Error: File '$1' not found"
    exit 1
fi

jq -r '
  (.nodes | map({(.name): {name: .name, notes: (.notes // ""), type: .type}}) | add) as $nodeMap |
  (.connections | to_entries | map({
    from: .key,
    to: [.value.main[]?[]?.node? // empty] | unique
  }) | map(select(.to != [])) | map({(.from): .to}) | add // {}) as $edges |
  ($nodeMap | keys) as $allNodes |
  ($edges | to_entries | map(.value[]) | flatten | unique) as $nodesWithIncoming |
  ($allNodes - $nodesWithIncoming) as $startNodes |
  def dfs(node; visited; result):
    if (visited | index(node) != null) then result
    else
      visited + [node] as $newVisited |
      result + [node] as $newResult |
      (($edges[node] // []) | reduce .[] as $child ($newResult; dfs($child; $newVisited; .)))
    end;
  def dedup:
    reduce .[] as $item ([]; if (. | index($item) == null) then . + [$item] else . end);
  ($startNodes | reduce .[] as $start ([]; dfs($start; []; .)) | dedup) as $executionOrder |
  $executionOrder | 
  to_entries | 
  map({
    order: (.key + 1),
    name: .value,
    type: $nodeMap[.value].type,
    notes: $nodeMap[.value].notes
  }) |
  .[] |
  "\(.order). \(.name) (\(.type))\n\(if .notes != "" then "   \(.notes | split("\n") | join("\n   "))\n" else "   (No description)\n" end)"
' "$1"

