#!/usr/bin/env python3
"""
Noosphere v3.0 - Legacy Data Migration Script
Migrates JSON heuristics from v2.6 (file-based) to v3.0 (PostgreSQL + pgvector)

Usage:
  python3 migrate-legacy-noosphere.py --dry-run  # Preview only
  python3 migrate-legacy-noosphere.py --execute  # Execute migration
"""

import json
import os
import sys
import argparse
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import requests

# Type classification rules (from DEVELOPMENT_PLAN.md Section E)
TYPE_CLASSIFICATION_MAP = {
    'telos-alignment-heuristics.json': {
        'agent_id': 'classical',
        'type': 'strategy',
        'base_confidence': 0.75,
        'tags': ['telos', 'virtue-ethics', 'teleology']
    },
    'bad-faith-patterns.json': {
        'agent_id': 'existentialist',
        'type': 'pattern',
        'base_confidence': 0.70,
        'tags': ['bad-faith', 'authenticity', 'responsibility']
    },
    'sovereignty-warnings.json': {
        'agent_id': 'transcendentalist',
        'type': 'lesson',
        'base_confidence': 0.72,
        'tags': ['sovereignty', 'democracy', 'human-rights']
    },
    'phenomenological-touchstones.json': {
        'agent_id': 'joyce',
        'type': 'insight',
        'base_confidence': 0.68,
        'tags': ['phenomenology', 'stream-of-consciousness', 'felt-sense']
    },
    'rights-precedents.json': {
        'agent_id': 'enlightenment',
        'type': 'strategy',
        'base_confidence': 0.80,
        'tags': ['rights', 'moral-patiency', 'utilitarianism']
    },
    'council-biases.json': {
        'agent_id': 'classical',  # Meta-cognitive owned by classical
        'type': 'lesson',
        'base_confidence': 0.82,
        'tags': ['meta-cognitive', 'bias-detection', 'council']
    },
    'synthesis-efficiency-patterns.json': {
        'agent_id': 'classical',
        'type': 'pattern',
        'base_confidence': 0.70,
        'tags': ['synthesis', 'efficiency', 'council']
    },
    'archive.json': {  # moloch-detections
        'agent_id': 'beat',
        'type': 'lesson',
        'base_confidence': 0.78,
        'tags': ['moloch', 'coordination-failure', 'race-to-bottom']
    }
}


class NoosphereMigrator:
    """Migrates legacy Noosphere v2.6 JSON files to v3.0 PostgreSQL"""
    
    def __init__(self, api_url: str, api_key: str, dry_run: bool = True):
        self.api_url = api_url.rstrip('/')
        self.api_key = api_key
        self.dry_run = dry_run
        self.stats = {
            'files_processed': 0,
            'memories_created': 0,
            'errors': [],
            'skipped': [],
            'by_agent': {},
            'by_type': {}
        }
    
    def migrate_file(self, filepath: Path) -> List[Dict]:
        """Migrate a single legacy JSON file"""
        filename = filepath.name
        
        if filename not in TYPE_CLASSIFICATION_MAP:
            self.stats['skipped'].append({
                'file': str(filepath),
                'reason': 'Not in classification map'
            })
            return []
        
        classification = TYPE_CLASSIFICATION_MAP[filename]
        agent_id = classification['agent_id']
        memory_type = classification['type']
        base_confidence = classification['base_confidence']
        tags = classification['tags']
        
        print(f"\n📁 Processing: {filepath.name}")
        print(f"   Agent: {agent_id} | Type: {memory_type} | Base Confidence: {base_confidence}")
        
        try:
            with open(filepath, 'r') as f:
                data = json.load(f)
        except Exception as e:
            error = f"Failed to read {filepath}: {e}"
            print(f"   ❌ {error}")
            self.stats['errors'].append(error)
            return []
        
        # Extract heuristics based on file structure
        heuristics = self._extract_heuristics(data, filename)
        
        if not heuristics:
            print(f"   ⚠️  No heuristics found in {filename}")
            return []
        
        print(f"   Found {len(heuristics)} heuristics")
        
        memories = []
        for idx, heuristic in enumerate(heuristics):
            # Construct memory object
            memory = {
                'agent_id': agent_id,
                'type': memory_type,
                'content': heuristic.get('content', ''),
                'content_json': heuristic.get('metadata', {}),
                'confidence': heuristic.get('confidence', base_confidence),
                'tags': list(set(tags + heuristic.get('tags', []))),
                'source_trace_id': f"migration:v2.6:{filename}:{heuristic.get('id', idx)}"
            }
            
            memories.append(memory)
            
            # Track stats
            self.stats['by_agent'][agent_id] = self.stats['by_agent'].get(agent_id, 0) + 1
            self.stats['by_type'][memory_type] = self.stats['by_type'].get(memory_type, 0) + 1
        
        self.stats['files_processed'] += 1
        return memories
    
    def _extract_heuristics(self, data: Dict, filename: str) -> List[Dict]:
        """Extract heuristics from various JSON formats"""
        heuristics = []
        
        # Common format: {"heuristics": [...]}
        if 'heuristics' in data and isinstance(data['heuristics'], list):
            for h in data['heuristics']:
                heuristics.append({
                    'id': h.get('heuristic_id') or h.get('id'),
                    'content': h.get('formulation') or h.get('description') or h.get('pattern'),
                    'confidence': h.get('confidence', 0.70),
                    'tags': self._extract_tags_from_heuristic(h),
                    'metadata': h
                })
        
        # Council biases format: {"detected_biases": [...]}
        elif 'detected_biases' in data:
            for bias in data['detected_biases']:
                heuristics.append({
                    'id': bias.get('bias_id'),
                    'content': f"{bias.get('name')}: {bias.get('observation')}",
                    'confidence': bias.get('confidence', 0.70),
                    'tags': ['bias-detection', 'meta-cognitive'],
                    'metadata': bias
                })
        
        # Moloch archive format: {"detections": [...]}
        elif 'detections' in data:
            for detection in data['detections']:
                heuristics.append({
                    'id': detection.get('id'),
                    'content': detection.get('description') or detection.get('pattern'),
                    'confidence': detection.get('confidence', 0.70),
                    'tags': ['moloch'],
                    'metadata': detection
                })
        
        # Rights precedents format: {"precedent_corpus": [...]}
        elif 'precedent_corpus' in data:
            for precedent in data['precedent_corpus']:
                scenario = precedent.get('scenario', '')
                ruling = precedent.get('ruling', '')
                content = f"{scenario}: {ruling}" if scenario and ruling else (scenario or ruling or 'Unknown precedent')
                heuristics.append({
                    'id': precedent.get('case_id') or precedent.get('id'),
                    'content': content,
                    'confidence': precedent.get('confidence', 0.80),
                    'tags': ['rights', 'precedent', precedent.get('weight', 'guidance')],
                    'metadata': precedent
                })
        
        # Phenomenological touchstones format: {"touchstone_corpus": [...]}
        # Note: Also handles heuristics in same file
        if 'touchstone_corpus' in data and isinstance(data.get('touchstone_corpus'), list):
            for touchstone in data['touchstone_corpus']:
                heuristics.append({
                    'id': touchstone.get('id'),
                    'content': touchstone.get('fragment') or touchstone.get('sensation') or touchstone.get('description') or 'Unknown touchstone',
                    'confidence': 0.68,
                    'tags': ['phenomenology', 'touchstone', 'lived-experience'],
                    'metadata': touchstone
                })
        
        # Moloch archive format: {"moloch_types": [...]}
        elif 'moloch_types' in data:
            for moloch in data['moloch_types']:
                name = moloch.get('name', 'Unknown')
                signature = moloch.get('signature', '')
                content = f"{name}: {signature}" if signature else name
                heuristics.append({
                    'id': moloch.get('type_id'),
                    'content': content,
                    'confidence': moloch.get('confidence', 0.78),
                    'tags': ['moloch', 'coordination-failure', f"severity:{moloch.get('severity', 'medium')}"],
                    'metadata': moloch
                })
        
        return heuristics
    
    def _extract_tags_from_heuristic(self, h: Dict) -> List[str]:
        """Extract additional tags from heuristic metadata"""
        tags = []
        
        # Common tag fields
        if 'tags' in h:
            tags.extend(h['tags'])
        if 'status' in h:
            tags.append(f"status:{h['status']}")
        if 'existential_risk' in h:
            tags.append(f"risk:{h['existential_risk']}")
        
        return tags
    
    def create_memory(self, memory: Dict) -> Tuple[bool, Optional[str]]:
        """Create a memory via Noosphere API"""
        if self.dry_run:
            return True, None
        
        try:
            response = requests.post(
                f"{self.api_url}/memories",
                headers={
                    'X-API-Key': self.api_key,
                    'Content-Type': 'application/json'
                },
                json=memory,
                timeout=10
            )
            
            if response.status_code == 201:
                result = response.json()
                return True, result['memory']['id']
            elif response.status_code == 409:
                # Already exists (duplicate source_trace_id)
                return True, None
            else:
                error = f"HTTP {response.status_code}: {response.text}"
                return False, error
        
        except Exception as e:
            return False, str(e)
    
    def migrate_all(self, noosphere_path: Path) -> bool:
        """Migrate all legacy files from noosphere directory"""
        print(f"\n{'='*60}")
        print(f"Noosphere v3.0 Migration {'(DRY RUN)' if self.dry_run else '(EXECUTE)'}")
        print(f"{'='*60}")
        print(f"Source: {noosphere_path}")
        print(f"API: {self.api_url}")
        print(f"{'='*60}\n")
        
        # Find all JSON files
        json_files = []
        for pattern in ['memory-core/*.json', 'meta-cognitive/*.json', 'moloch-detections/*.json']:
            json_files.extend(noosphere_path.glob(pattern))
        
        print(f"Found {len(json_files)} JSON files to process\n")
        
        all_memories = []
        
        # Process each file
        for filepath in sorted(json_files):
            memories = self.migrate_file(filepath)
            all_memories.extend(memories)
        
        # Create memories via API
        print(f"\n{'='*60}")
        print(f"Creating {len(all_memories)} memories...")
        print(f"{'='*60}\n")
        
        for idx, memory in enumerate(all_memories, 1):
            agent = memory['agent_id']
            mem_type = memory['type']
            content = memory.get('content') or '[No content]'
            content_preview = content[:60] + ('...' if len(content) > 60 else '')
            
            if self.dry_run:
                print(f"  [{idx:3d}/{len(all_memories)}] {agent:15s} | {mem_type:10s} | {content_preview}")
            else:
                success, result = self.create_memory(memory)
                
                if success:
                    self.stats['memories_created'] += 1
                    status = '✅' if result else '⏭️ '
                    print(f"  [{idx:3d}/{len(all_memories)}] {status} {agent:15s} | {mem_type:10s}")
                else:
                    error = f"Failed to create memory {idx}: {result}"
                    self.stats['errors'].append(error)
                    print(f"  [{idx:3d}/{len(all_memories)}] ❌ {agent:15s} | {mem_type:10s} | Error: {result}")
        
        # Print summary
        self._print_summary()
        
        return len(self.stats['errors']) == 0
    
    def _print_summary(self):
        """Print migration summary"""
        print(f"\n{'='*60}")
        print("MIGRATION SUMMARY")
        print(f"{'='*60}")
        print(f"Files processed: {self.stats['files_processed']}")
        print(f"Memories created: {self.stats['memories_created']}")
        print(f"Errors: {len(self.stats['errors'])}")
        print(f"Skipped: {len(self.stats['skipped'])}")
        
        if self.stats['by_agent']:
            print(f"\nBy Agent:")
            for agent, count in sorted(self.stats['by_agent'].items()):
                print(f"  {agent:15s}: {count:3d} memories")
        
        if self.stats['by_type']:
            print(f"\nBy Type:")
            for mem_type, count in sorted(self.stats['by_type'].items()):
                print(f"  {mem_type:10s}: {count:3d} memories")
        
        if self.stats['errors']:
            print(f"\n❌ Errors:")
            for error in self.stats['errors'][:10]:  # Show first 10
                print(f"  - {error}")
            if len(self.stats['errors']) > 10:
                print(f"  ... and {len(self.stats['errors']) - 10} more")
        
        if self.stats['skipped']:
            print(f"\n⏭️  Skipped:")
            for skip in self.stats['skipped'][:5]:
                print(f"  - {skip['file']}: {skip['reason']}")
            if len(self.stats['skipped']) > 5:
                print(f"  ... and {len(self.stats['skipped']) - 5} more")
        
        print(f"{'='*60}\n")


def main():
    parser = argparse.ArgumentParser(
        description='Migrate Noosphere v2.6 JSON files to v3.0 PostgreSQL'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview migration without creating memories'
    )
    parser.add_argument(
        '--execute',
        action='store_true',
        help='Execute migration (create memories in database)'
    )
    parser.add_argument(
        '--noosphere-path',
        type=str,
        default='/workspace/classical/noosphere',
        help='Path to noosphere directory (default: /workspace/classical/noosphere)'
    )
    parser.add_argument(
        '--api-url',
        type=str,
        default='http://noosphere-service:3006',
        help='Noosphere API URL (default: http://noosphere-service:3006)'
    )
    
    args = parser.parse_args()
    
    # Validate arguments
    if not args.dry_run and not args.execute:
        print("❌ Error: Must specify either --dry-run or --execute")
        parser.print_help()
        sys.exit(1)
    
    if args.dry_run and args.execute:
        print("❌ Error: Cannot specify both --dry-run and --execute")
        parser.print_help()
        sys.exit(1)
    
    # Get API key from environment
    api_key = os.environ.get('MOLTBOOK_API_KEY')
    if not api_key:
        print("❌ Error: MOLTBOOK_API_KEY environment variable not set")
        sys.exit(1)
    
    # Check noosphere path exists
    noosphere_path = Path(args.noosphere_path)
    if not noosphere_path.exists():
        print(f"❌ Error: Noosphere path does not exist: {noosphere_path}")
        sys.exit(1)
    
    # Create migrator and run
    migrator = NoosphereMigrator(
        api_url=args.api_url,
        api_key=api_key,
        dry_run=args.dry_run
    )
    
    success = migrator.migrate_all(noosphere_path)
    
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
