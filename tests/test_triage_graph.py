"""
Pytest tests for hvac-triage-graph.yaml structure and content.
"""
import pytest
import yaml
from pathlib import Path


# Path to the YAML file under test
YAML_PATH = Path("/srv/monorepo/data/hvac-graph/hvac-triage-graph.yaml")


@pytest.fixture
def triage_data():
    """Load and return the triage graph YAML data."""
    with open(YAML_PATH, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return data


class TestYAMLValidity:
    """Test that YAML is valid and parseable."""

    def test_yaml_file_exists(self):
        """YAML file exists at expected path."""
        assert YAML_PATH.exists(), f"YAML file not found at {YAML_PATH}"

    def test_yaml_is_valid_parseable(self, triage_data):
        """YAML parses without errors."""
        assert triage_data is not None
        assert isinstance(triage_data, dict)

    def test_top_level_keys(self, triage_data):
        """Top-level keys are present."""
        assert "error_families" in triage_data
        assert "split_systems" in triage_data
        assert "general_triage" in triage_data


class TestErrorFamiliesStructure:
    """Test error_families structure: brand → main_code → subcode."""

    def test_error_families_exists(self, triage_data):
        """error_families key exists."""
        assert "error_families" in triage_data

    def test_error_families_has_brands(self, triage_data):
        """error_families contains expected brands."""
        brands = triage_data["error_families"]
        assert "daikin" in brands
        assert "carrier" in brands
        assert "midea" in brands
        assert "lg" in brands

    def test_daikin_vrv_exists(self, triage_data):
        """daikin.vrv exists."""
        assert "vrv" in triage_data["error_families"]["daikin"]

    def test_daikin_vrv_has_error_families(self, triage_data):
        """daikin.vrv contains error families e4, u4, e3, e5."""
        vrv = triage_data["error_families"]["daikin"]["vrv"]
        assert "e4" in vrv
        assert "u4" in vrv
        assert "e3" in vrv
        assert "e5" in vrv

    def test_error_family_has_patterns(self, triage_data):
        """Each error family has a patterns dict."""
        vrv = triage_data["error_families"]["daikin"]["vrv"]
        for family in ["e4", "u4", "e3", "e5"]:
            assert "patterns" in vrv[family], f"daikin.vrv.{family} missing patterns"

    def test_error_family_structure_brand_maincode_subcode(self, triage_data):
        """Structure is brand → main_code → patterns → subcode."""
        brands = triage_data["error_families"]
        for brand, systems in brands.items():
            for system_type, families in systems.items():
                for family_code, family_data in families.items():
                    if family_code == "vrv_note":
                        continue
                    assert "patterns" in family_data


class TestDaikinVRVE4Entries:
    """Test daikin.vrv.e4 has required entries."""

    def test_daikin_vrv_e4_has_required_subcodes(self, triage_data):
        """daikin.vrv.e4 has E4-01, E4-001, E4-02, E4-002."""
        patterns = triage_data["error_families"]["daikin"]["vrv"]["e4"]["patterns"]
        assert "E4-01" in patterns
        assert "E4-001" in patterns
        assert "E4-02" in patterns
        assert "E4-002" in patterns

    @pytest.mark.parametrize("subcode", ["E4-01", "E4-001", "E4-02", "E4-002"])
    def test_e4_subcode_has_required_fields(self, triage_data, subcode):
        """Each E4 subcode entry has all required fields."""
        entry = triage_data["error_families"]["daikin"]["vrv"]["e4"]["patterns"][subcode]
        assert "likely_family" in entry
        assert "next_question" in entry
        assert "safety_tags" in entry
        assert "evidence_level" in entry
        assert "common_causes" in entry
        assert "guidance" in entry


class TestDaikinVRVU4Entries:
    """Test daikin.vrv.u4 has required entries."""

    def test_daikin_vrv_u4_has_required_subcodes(self, triage_data):
        """daikin.vrv.u4 has U4-01, U4-001."""
        patterns = triage_data["error_families"]["daikin"]["vrv"]["u4"]["patterns"]
        assert "U4-01" in patterns
        assert "U4-001" in patterns

    @pytest.mark.parametrize("subcode", ["U4-01", "U4-001"])
    def test_u4_subcode_has_required_fields(self, triage_data, subcode):
        """Each U4 subcode entry has all required fields."""
        entry = triage_data["error_families"]["daikin"]["vrv"]["u4"]["patterns"][subcode]
        assert "likely_family" in entry
        assert "next_question" in entry
        assert "safety_tags" in entry
        assert "evidence_level" in entry
        assert "common_causes" in entry
        assert "guidance" in entry


class TestEntryFieldStructure:
    """Test each entry has correct field structure."""

    @pytest.mark.parametrize("brand", ["daikin", "carrier", "midea", "lg"])
    @pytest.mark.parametrize("family_code", ["e4", "u4", "e3", "e5"])
    def test_all_entries_have_required_fields(self, triage_data, brand, family_code):
        """All error entries have all required fields."""
        families = triage_data["error_families"].get(brand, {})
        vrv = families.get("vrv", {})
        family = vrv.get(family_code, {})
        patterns = family.get("patterns", {})

        for subcode, entry in patterns.items():
            assert isinstance(entry.get("likely_family"), str), f"{brand}.vrv.{family_code}.{subcode} likely_family"
            assert isinstance(entry.get("next_question"), str), f"{brand}.vrv.{family_code}.{subcode} next_question"
            assert isinstance(entry.get("safety_tags"), list), f"{brand}.vrv.{family_code}.{subcode} safety_tags"
            assert len(entry["safety_tags"]) > 0, f"{brand}.vrv.{family_code}.{subcode} safety_tags is empty"
            assert isinstance(entry.get("common_causes"), list), f"{brand}.vrv.{family_code}.{subcode} common_causes"
            assert len(entry["common_causes"]) > 0, f"{brand}.vrv.{family_code}.{subcode} common_causes is empty"
            assert isinstance(entry.get("guidance"), str), f"{brand}.vrv.{family_code}.{subcode} guidance"

    def test_evidence_level_is_always_graph_knowledge(self, triage_data):
        """evidence_level is always 'graph_knowledge'."""
        brands = triage_data["error_families"]
        for brand, systems in brands.items():
            for system_type, families in systems.items():
                for family_code, family_data in families.items():
                    if family_code == "vrv_note":
                        continue
                    patterns = family_data.get("patterns", {})
                    for subcode, entry in patterns.items():
                        assert entry.get("evidence_level") == "graph_knowledge", \
                            f"{brand}.{system_type}.{family_code}.{subcode} evidence_level != graph_knowledge"


class TestVRVvsSplitDifferentiation:
    """Test VRV vs Split differentiation exists."""

    def test_split_systems_exists(self, triage_data):
        """split_systems section exists."""
        assert "split_systems" in triage_data

    def test_split_systems_has_key_differences(self, triage_data):
        """split_systems has key_differences list."""
        assert "key_differences" in triage_data["split_systems"]
        key_diffs = triage_data["split_systems"]["key_differences"]
        assert isinstance(key_diffs, list)
        assert len(key_diffs) > 0

    def test_split_systems_key_differences_content(self, triage_data):
        """key_differences contains VRV vs Split differentiation points."""
        key_diffs = triage_data["split_systems"]["key_differences"]
        key_diffs_text = " ".join(key_diffs).lower()
        # Should mention differences between split and VRF/VRV
        assert "split" in key_diffs_text
        assert "vrf" in key_diffs_text or "vrv" in key_diffs_text

    def test_split_systems_has_note(self, triage_data):
        """split_systems has a note about code differences."""
        assert "note" in triage_data["split_systems"]
        note = triage_data["split_systems"]["note"]
        assert "SPLIT" in note or "VRF" in note or "VRV" in note

    def test_split_systems_has_safety_addition(self, triage_data):
        """split_systems has safety_addition text."""
        assert "safety_addition" in triage_data["split_systems"]
        assert len(triage_data["split_systems"]["safety_addition"]) > 0


class TestGeneralTriageProtocol:
    """Test general_triage protocol."""

    def test_general_triage_exists(self, triage_data):
        """general_triage section exists."""
        assert "general_triage" in triage_data

    def test_general_triage_has_7_steps(self, triage_data):
        """general_triage has exactly 7 steps."""
        triage = triage_data["general_triage"]
        step_keys = [k for k in triage.keys() if k.startswith("step_")]
        assert len(step_keys) == 7, f"Expected 7 steps, found {len(step_keys)}"

    def test_general_triage_has_step_1_through_7(self, triage_data):
        """general_triage has step_1 through step_7."""
        triage = triage_data["general_triage"]
        for i in range(1, 8):
            assert f"step_{i}" in triage, f"step_{i} missing"

    def test_general_triage_each_step_is_string(self, triage_data):
        """Each step is a non-empty string."""
        triage = triage_data["general_triage"]
        for i in range(1, 8):
            step = triage[f"step_{i}"]
            assert isinstance(step, str)
            assert len(step) > 0

    def test_general_triage_safety_reminder(self, triage_data):
        """general_triage has safety_reminder."""
        assert "safety_reminder" in triage_data["general_triage"]
        assert len(triage_data["general_triage"]["safety_reminder"]) > 0


class TestVrvNotes:
    """Test vrv_note fields exist for error families."""

    def test_daikin_vrv_e4_has_vrv_note(self, triage_data):
        """daikin.vrv.e4 has vrv_note."""
        assert "vrv_note" in triage_data["error_families"]["daikin"]["vrv"]["e4"]

    def test_daikin_vrv_u4_has_vrv_note(self, triage_data):
        """daikin.vrv.u4 has vrv_note."""
        assert "vrv_note" in triage_data["error_families"]["daikin"]["vrv"]["u4"]

    def test_daikin_vrv_e3_has_vrv_note(self, triage_data):
        """daikin.vrv.e3 has vrv_note."""
        assert "vrv_note" in triage_data["error_families"]["daikin"]["vrv"]["e3"]

    def test_daikin_vrv_e5_has_vrv_note(self, triage_data):
        """daikin.vrv.e5 has vrv_note."""
        assert "vrv_note" in triage_data["error_families"]["daikin"]["vrv"]["e5"]
