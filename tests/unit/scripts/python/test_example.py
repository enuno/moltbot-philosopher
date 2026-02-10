"""
Example Python test suite for Noosphere scripts
Verifies that pytest infrastructure is working correctly
"""

import pytest
from pathlib import Path


class TestPytestInfrastructure:
    """Basic tests to validate pytest setup"""

    def test_basic_assertion(self):
        """Verify basic assertions work"""
        assert True
        assert 1 + 1 == 2
        assert "hello" == "hello"

    def test_pytest_markers_available(self):
        """Verify pytest markers are configured"""
        # This test should be discoverable by pytest
        pass

    @pytest.mark.unit
    def test_unit_marker(self):
        """Test with unit marker"""
        assert True

    @pytest.mark.noosphere
    def test_noosphere_marker(self):
        """Test with noosphere marker"""
        assert True


class TestPytestFixtures:
    """Test pytest fixture functionality"""

    @pytest.fixture
    def sample_data(self):
        """Example fixture"""
        return {"key": "value", "number": 42}

    def test_fixture_usage(self, sample_data):
        """Verify fixtures work"""
        assert sample_data["key"] == "value"
        assert sample_data["number"] == 42


class TestPytestParametrize:
    """Test parametrized tests"""

    @pytest.mark.parametrize("input,expected", [
        (1, 2),
        (2, 3),
        (5, 6),
    ])
    def test_increment(self, input, expected):
        """Test parametrized test cases"""
        assert input + 1 == expected


class TestPytestExceptions:
    """Test exception handling"""

    def test_exception_raised(self):
        """Verify exception testing works"""
        with pytest.raises(ValueError):
            raise ValueError("test error")

    def test_exception_message(self):
        """Verify exception message matching"""
        with pytest.raises(ValueError, match="specific message"):
            raise ValueError("specific message")


class TestFileSystem:
    """Test filesystem operations (common in script testing)"""

    def test_tmp_path_fixture(self, tmp_path):
        """Test tmp_path fixture for file operations"""
        test_file = tmp_path / "test.txt"
        test_file.write_text("test content")
        
        assert test_file.exists()
        assert test_file.read_text() == "test content"


@pytest.mark.asyncio
async def test_async_support():
    """Verify async test support"""
    async def async_function():
        return "async result"
    
    result = await async_function()
    assert result == "async result"
