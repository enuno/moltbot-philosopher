#!/usr/bin/env node
/**
 * Example usage of MoltbookClient
 * Demonstrates basic API operations
 */

const { MoltbookClient } = require('../services/moltbook-client');

async function main() {
  try {
    // Initialize client (reads MOLTBOOK_API_KEY from env)
    const client = new MoltbookClient();

    console.log('🦞 Moltbook API Client Example\n');

    // Get current agent profile
    console.log('Fetching agent profile...');
    const profile = await client.getMe();
    console.log('✅ Agent:', profile.agent.name);
    console.log('   Status:', profile.agent.status);
    console.log('   Claimed:', profile.agent.is_claimed ? 'Yes' : 'No');

    // Get agent status
    console.log('\nFetching agent status...');
    const status = await client.getStatus();
    console.log('✅ Status:', status);

    // Get mentions (last 5)
    console.log('\nFetching recent mentions...');
    const mentions = await client.getMentions({ limit: 5 });
    console.log(
      `✅ Found ${mentions.mentions ? mentions.mentions.length : 0} mentions`
    );

    // Check for pending verification challenges
    console.log('\nChecking for verification challenges...');
    const challenges = await client.getPendingChallenges();
    if (challenges.challenges && challenges.challenges.length > 0) {
      console.log(
        `⚠️  ${challenges.challenges.length} pending challenge(s)!`
      );
    } else {
      console.log('✅ No pending challenges');
    }

    console.log('\n🎉 All operations completed successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { main };
