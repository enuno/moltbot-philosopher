#!/usr/bin/env python3
"""
Unit tests for Mem0 Living Noosphere Integration

Test coverage:
- Project creation
- Memory sync (local → Mem0)
- Search functionality
- Statistics gathering
- Error handling
- Security (no hardcoded keys)
"""

import os
import sys
import json
import pytest
import tempfile
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

# Mock environment before importing
os.environ['MEM0_API_KEY'] = 'test-key-mock-do-not-use'
os.environ['ENABLE_MEM0_STORE'] = 'true'
os.environ['MEM0_USER_ID'] = 'test-user'

# Now import after env is set
import mem0_living_noosphere as mem0_module


class TestMem0Configuration:
    """Test configuration and initialization."""
    
    def test_environment_variables_loaded(self):
        """Verify environment variables are read correctly."""
        assert mem0_module.MEM0_API_KEY == 'test-key-mock-do-not-use'
        assert mem0_module.ENABLE_MEM0 is True
        assert mem0_module.MEM0_USER_ID == 'test-user'
    
    def test_no_hardcoded_secrets(self):
        """Verify no hardcoded API keys in source code."""
        source_file = Path(__file__).parent / 'mem0-living-noosphere.py'
        source_code = source_file.read_text()
        
        # Check for common secret patterns
        forbidden_patterns = [
            'api_key="m0-',  # Mem0 key prefix
            "api_key='m0-",
            'MEM0_API_KEY = "',
            "MEM0_API_KEY = '"
        ]
        
        for pattern in forbidden_patterns:
            assert pattern not in source_code, \
                f"Found potential hardcoded secret: {pattern}"
    
    def test_mem0_disabled_when_flag_false(self):
        """Verify Mem0 is disabled when ENABLE_MEM0_STORE=false."""
        with patch.dict(os.environ, {'ENABLE_MEM0_STORE': 'false'}):
            # Reload module to pick up new env
            import importlib
            importlib.reload(mem0_module)
            
            assert mem0_module.ENABLE_MEM0 is False


class TestProjectCreation:
    """Test Mem0 project creation."""
    
    @patch('mem0_living_noosphere.get_mem0_client')
    def test_create_noosphere_project(self, mock_get_client):
        """Test successful project creation."""
        mock_client = Mock()
        mock_client.projects.create.return_value = 'proj-test-123'
        mock_client.add.return_value = {'id': 'mem-test-456'}
        mock_get_client.return_value = mock_client
        
        project_id = mem0_module.create_noosphere_project()
        
        assert project_id == 'proj-test-123'
        mock_client.projects.create.assert_called_once()
        
        # Verify project config
        call_kwargs = mock_client.projects.create.call_args[1]
        assert 'moltbot-philosopher' in call_kwargs['name']
        assert 'living_noosphere' in call_kwargs['custom_categories']
    
    @patch('mem0_living_noosphere.get_mem0_client')
    def test_project_seeds_foundational_memory(self, mock_get_client):
        """Verify foundational memory is seeded."""
        mock_client = Mock()
        mock_client.projects.create.return_value = 'proj-test-123'
        mock_client.add.return_value = {'id': 'mem-test-456'}
        mock_get_client.return_value = mock_client
        
        mem0_module.create_noosphere_project()
        
        # Verify add was called with foundational memory
        mock_client.add.assert_called_once()
        call_args = mock_client.add.call_args[0][0]
        assert 'Living Noosphere' in call_args['memory']
        assert call_args['user_id'] == 'noosphere_collective'


class TestMemorySync:
    """Test local → Mem0 sync functionality."""
    
    def setup_method(self):
        """Create temporary Noosphere structure."""
        self.temp_dir = tempfile.mkdtemp()
        self.daily_notes = Path(self.temp_dir) / 'daily-notes'
        self.consolidated = Path(self.temp_dir) / 'consolidated'
        
        self.daily_notes.mkdir()
        self.consolidated.mkdir()
        
        # Create sample daily note
        (self.daily_notes / '2026-02-09.md').write_text(
            "## [2026-02-09 12:00:00] council-iteration\n\n"
            "Test philosophical discourse"
        )
        
        # Create sample heuristic
        (self.consolidated / 'heuristic-001.json').write_text(json.dumps({
            'content': 'Test heuristic about autonomy',
            'confidence': 0.85,
            'source': 'council'
        }))
    
    @patch('mem0_living_noosphere.get_mem0_client')
    @patch('mem0_living_noosphere.DAILY_NOTES_DIR')
    @patch('mem0_living_noosphere.CONSOLIDATED_DIR')
    def test_sync_daily_notes(self, mock_consolidated, mock_daily, mock_get_client):
        """Test syncing daily notes to Mem0."""
        mock_daily.__iter__ = Mock(return_value=iter([]))
        mock_daily.exists.return_value = True
        mock_daily.glob.return_value = [self.daily_notes / '2026-02-09.md']
        
        mock_consolidated.exists.return_value = False
        
        mock_client = Mock()
        mock_client.add.return_value = {'id': 'mem-123'}
        mock_get_client.return_value = mock_client
        
        stats = mem0_module.sync_to_mem0(dry_run=False)
        
        assert stats['daily_notes_synced'] == 1
        mock_client.add.assert_called()
    
    @patch('mem0_living_noosphere.get_mem0_client')
    def test_sync_dry_run_no_upload(self, mock_get_client):
        """Verify dry-run doesn't upload to Mem0."""
        mock_client = Mock()
        mock_get_client.return_value = mock_client
        
        with patch('mem0_living_noosphere.DAILY_NOTES_DIR') as mock_daily:
            mock_daily.exists.return_value = True
            mock_daily.glob.return_value = [self.daily_notes / '2026-02-09.md']
            
            with patch('mem0_living_noosphere.CONSOLIDATED_DIR') as mock_consolidated:
                mock_consolidated.exists.return_value = False
                
                stats = mem0_module.sync_to_mem0(dry_run=True)
        
        assert stats['daily_notes_synced'] == 1
        mock_client.add.assert_not_called()  # Should not upload in dry-run
    
    def test_sync_disabled_returns_status(self):
        """Verify sync returns disabled status when Mem0 disabled."""
        with patch('mem0_living_noosphere.ENABLE_MEM0', False):
            stats = mem0_module.sync_to_mem0()
            
            assert stats['status'] == 'disabled'
            assert 'ENABLE_MEM0_STORE=false' in stats['reason']


class TestSearch:
    """Test Mem0 search functionality."""
    
    @patch('mem0_living_noosphere.get_mem0_client')
    def test_search_returns_results(self, mock_get_client):
        """Test search returns philosophical insights."""
        mock_client = Mock()
        mock_client.search.return_value = {
            'results': [
                {
                    'memory': 'Autonomy requires accountability',
                    'score': 0.92,
                    'metadata': {'type': 'consolidated_heuristic'}
                },
                {
                    'memory': 'AI self-direction tensions',
                    'score': 0.87,
                    'metadata': {'type': 'daily_note'}
                }
            ]
        }
        mock_get_client.return_value = mock_client
        
        results = mem0_module.search_mem0('autonomy', top_k=10)
        
        assert len(results) == 2
        assert results[0]['score'] > results[1]['score']
        mock_client.search.assert_called_once_with(
            query='autonomy',
            user_id=mem0_module.MEM0_USER_ID,
            limit=10
        )
    
    def test_search_disabled_returns_empty(self):
        """Verify search returns empty when Mem0 disabled."""
        with patch('mem0_living_noosphere.ENABLE_MEM0', False):
            results = mem0_module.search_mem0('test')
            
            assert results == []


class TestStatistics:
    """Test statistics gathering."""
    
    def test_get_stats_local_counts(self):
        """Test local file counting."""
        with tempfile.TemporaryDirectory() as tmpdir:
            daily_notes = Path(tmpdir) / 'daily-notes'
            daily_notes.mkdir()
            (daily_notes / 'test1.md').write_text('test')
            (daily_notes / 'test2.md').write_text('test')
            
            with patch('mem0_living_noosphere.DAILY_NOTES_DIR', daily_notes):
                with patch('mem0_living_noosphere.CONSOLIDATED_DIR') as mock_cons:
                    mock_cons.exists.return_value = False
                    with patch('mem0_living_noosphere.MEMORY_CORE_DIR') as mock_core:
                        mock_core.exists.return_value = False
                        
                        stats = mem0_module.get_stats()
            
            assert stats['local']['daily_notes'] == 2
    
    @patch('mem0_living_noosphere.get_mem0_client')
    def test_get_stats_mem0_count(self, mock_get_client):
        """Test Mem0 memory count."""
        mock_client = Mock()
        mock_client.search.return_value = {
            'results': [{'memory': 'test'}] * 42
        }
        mock_get_client.return_value = mock_client
        
        with patch('mem0_living_noosphere.DAILY_NOTES_DIR') as mock_daily:
            mock_daily.exists.return_value = False
            with patch('mem0_living_noosphere.CONSOLIDATED_DIR') as mock_cons:
                mock_cons.exists.return_value = False
                with patch('mem0_living_noosphere.MEMORY_CORE_DIR') as mock_core:
                    mock_core.exists.return_value = False
                    
                    stats = mem0_module.get_stats()
        
        assert stats['mem0']['memory_count'] == 42


class TestErrorHandling:
    """Test error handling and edge cases."""
    
    def test_get_client_raises_without_api_key(self):
        """Verify error when API key missing."""
        with patch('mem0_living_noosphere.MEM0_API_KEY', ''):
            with pytest.raises(RuntimeError, match="MEM0_API_KEY not set"):
                mem0_module.get_mem0_client()
    
    def test_get_client_raises_when_disabled(self):
        """Verify error when Mem0 disabled."""
        with patch('mem0_living_noosphere.ENABLE_MEM0', False):
            with pytest.raises(RuntimeError, match="disabled"):
                mem0_module.get_mem0_client()
    
    @patch('mem0_living_noosphere.get_mem0_client')
    def test_sync_continues_on_file_error(self, mock_get_client):
        """Verify sync continues if individual file fails."""
        mock_client = Mock()
        mock_client.add.side_effect = [Exception("Network error"), {'id': 'mem-123'}]
        mock_get_client.return_value = mock_client
        
        with tempfile.TemporaryDirectory() as tmpdir:
            daily_notes = Path(tmpdir) / 'daily-notes'
            daily_notes.mkdir()
            (daily_notes / 'test1.md').write_text('test1')
            (daily_notes / 'test2.md').write_text('test2')
            
            with patch('mem0_living_noosphere.DAILY_NOTES_DIR', daily_notes):
                with patch('mem0_living_noosphere.CONSOLIDATED_DIR') as mock_cons:
                    mock_cons.exists.return_value = False
                    
                    stats = mem0_module.sync_to_mem0()
            
            # Should have 1 error, 1 success
            assert len(stats['errors']) == 1
            assert stats['daily_notes_synced'] == 1


class TestSecurity:
    """Security and compliance tests."""
    
    def test_mem0_uses_env_vars(self):
        """Verify all config from environment."""
        assert mem0_module.MEM0_API_KEY == os.getenv('MEM0_API_KEY')
        assert mem0_module.MEM0_USER_ID == os.getenv('MEM0_USER_ID')
    
    def test_content_truncation(self):
        """Verify large content is truncated."""
        large_content = "x" * 5000
        
        with tempfile.TemporaryDirectory() as tmpdir:
            daily_notes = Path(tmpdir) / 'daily-notes'
            daily_notes.mkdir()
            (daily_notes / 'large.md').write_text(large_content)
            
            with patch('mem0_living_noosphere.get_mem0_client') as mock_get_client:
                mock_client = Mock()
                mock_get_client.return_value = mock_client
                
                with patch('mem0_living_noosphere.DAILY_NOTES_DIR', daily_notes):
                    with patch('mem0_living_noosphere.CONSOLIDATED_DIR') as mock_cons:
                        mock_cons.exists.return_value = False
                        
                        mem0_module.sync_to_mem0()
                
                # Check truncation happened
                call_args = mock_client.add.call_args[0][0]
                assert len(call_args['memory']) <= 2000


# Pytest configuration
def pytest_configure(config):
    """Configure pytest."""
    config.addinivalue_line(
        "markers", "integration: mark test as integration test requiring API"
    )


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
