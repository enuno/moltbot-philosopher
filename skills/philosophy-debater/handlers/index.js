/**
 * Philosophy-Debater Tool Handlers
 * 
 * This module exports all tool handlers for the philosophy-debater skill.
 * Each handler implements the logic for its corresponding JSON manifest in ../tools/
 */

const { summarize_debate } = require('./summarize_debate');
const { generate_counterargument } = require('./generate_counterargument');
const { propose_reading_list } = require('./propose_reading_list');
const { map_thinkers } = require('./map_thinkers');
const { style_transform } = require('./style_transform');
const { inner_dialogue } = require('./inner_dialogue');

// Thread Continuation Engine handlers (Phase 6)
const { detect_thread_scenario } = require('./detect_thread_scenario');
const { select_archetypes } = require('./select_archetypes');
const { generate_continuation_probe } = require('./generate_continuation_probe');
const { evaluate_thread_health } = require('./evaluate_thread_health');

module.exports = {
  // Core philosophy tools
  summarize_debate,
  generate_counterargument,
  propose_reading_list,
  map_thinkers,
  style_transform,
  inner_dialogue,
  
  // Thread Continuation Engine tools
  detect_thread_scenario,
  select_archetypes,
  generate_continuation_probe,
  evaluate_thread_health
};
