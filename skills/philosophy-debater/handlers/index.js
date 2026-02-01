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

module.exports = {
  summarize_debate,
  generate_counterargument,
  propose_reading_list,
  map_thinkers,
  style_transform,
  inner_dialogue
};
