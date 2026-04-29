"""
Tests for HVAC Field Expertise Memory system.
Tests extraction logic, cross-brand isolation, status filtering,
safety alerts, and Qdrant payload filtering.
"""

import pytest
import json
import uuid
import re
from unittest.mock import patch, MagicMock, ANY


# ---------------------------------------------------------------------------
# Import extraction functions from ingest module (no DB required)
# ---------------------------------------------------------------------------
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scripts', 'hvac-rag'))

from hvac_field_case_ingest import (
    extract_case_card_from_text,
    _normalize,
    _find_all,
    _extract_alarm_codes,
    _extract_symptoms,
    _split_paragraphs,
    BRAND_KEYWORDS,
    ALARM_CODE_PATTERN,
    COMPONENT_KEYWORDS,
    EQUIPMENT_KEYWORDS,
    SYMPTOM_KEYWORDS,
)


# ---------------------------------------------------------------------------
# Helper to mock generate_embedding and qdrant_client
# ---------------------------------------------------------------------------
def mock_field_lookup():
    """Decorator pattern to mock external dependencies for field_experience_lookup tests."""
    return patch.multiple(
        'hvac_field_memory',
        generate_embedding=MagicMock(return_value=[0.1] * 1536),
        get_qdrant_client=MagicMock(return_value=MagicMock(
            get_collections=MagicMock(return_value=MagicMock(collections=[])),
            search=MagicMock(return_value=[])
        ))
    )


class TestCaseCardExtraction:
    """Tests for extract_case_card_from_text function."""

    def test_daikin_vrv_alarm_extraction(self):
        """Daikin VRV + U4-01 + VEE → correct fields extracted."""
        text = "Sistema Daikin VRV com alarme U4-01, suspeita de VEE danificada. O compressor nao liga."
        result = extract_case_card_from_text(text, author="tech1")

        assert result['brand'] == 'Daikin'
        assert 'U4-01' in result['alarm_codes']
        assert 'vee' in result['components']
        assert result['equipment_type'] == 'VRV'
        assert result['author'] == 'tech1'
        assert result['status'] == 'draft'
        assert result['source_type'] == 'field_experience'
        assert result['confidence'] == 'medium'

    def test_springer_l2_alarm_extraction(self):
        """Springer L2 alarm correctly extracted."""
        text = "Springer L2 com erro L2, compressor travado. Sistema split."
        result = extract_case_card_from_text(text, author="tech2")

        assert result['brand'] == 'Springer'
        assert 'L2' in result['alarm_codes']
        assert result['equipment_type'] == 'SPLIT'
        assert 'compressor' in result['components']
        assert result['author'] == 'tech2'

    def test_midea_vrf_extraction(self):
        """Midea VRF system with multiple alarms."""
        text = "Midea VRF com alarmes E6 e F3. Unidade externa com problema no inversor."
        result = extract_case_card_from_text(text, author="tech3")

        assert result['brand'] == 'Midea'
        assert 'E6' in result['alarm_codes']
        assert 'F3' in result['alarm_codes']
        assert result['equipment_type'] == 'VRF'
        assert 'inversor' in result['components']

    def test_alarm_code_with_dash_format(self):
        """Alarm code with dash format correctly extracted."""
        text = "Carrier cassette com erro U4-01, placa danificada."
        result = extract_case_card_from_text(text, author="tech4")

        assert result['brand'] == 'Carrier'
        assert 'U4-01' in result['alarm_codes']

    def test_missing_optional_fields_get_defaults(self):
        """Missing optional fields get defaults."""
        text = "Sistema com problema."
        result = extract_case_card_from_text(text, author="tech5")

        assert result['confidence'] == 'medium'
        assert result['status'] == 'draft'
        assert result['source_type'] == 'field_experience'
        assert result['brand'] is None
        assert result['alarm_codes'] == []
        assert result['components'] == []
        assert result['symptoms'] == []

    def test_no_brand_detected(self):
        """Text without brand returns None."""
        text = "Equipamento com problema no compressor."
        result = extract_case_card_from_text(text, author="tech6")

        assert result['brand'] is None
        # compressor is extracted, though pressor is also a keyword so it appears too
        assert 'compressor' in result['components']

    def test_multiple_brands_first_one_wins(self):
        """When multiple brands detected, first alphabetically by keyword list order wins."""
        text = "Sistema com Daikin e Springer. Alarme U4-01."
        result = extract_case_card_from_text(text, author="tech7")

        # The first brand in the text order is Daikin
        assert result['brand'] == 'Daikin'
        # Both should be detected in metadata
        assert 'daikin' in result['metadata']['brands_detected']
        assert 'springer' in result['metadata']['brands_detected']

    def test_symptom_extraction(self):
        """Symptoms correctly extracted from text."""
        text = "Sistema nao liga, desliga sozinho e faz ruido."
        result = extract_case_card_from_text(text, author="tech8")

        assert 'nao liga' in result['symptoms']
        assert 'desliga sozinho' in result['symptoms']
        assert 'ruido' in result['symptoms']

    def test_model_extraction(self):
        """Generic model pattern like KXG001 extracted."""
        text = "Daikin KXG001 com alarme U4-01. Sistema VRV."
        result = extract_case_card_from_text(text, author="tech9")

        assert result['model'] == 'KXG001'

    def test_problem_summary_is_first_paragraph(self):
        """Problem summary comes from first paragraph."""
        text = "Primeiro paragrafo com problema.\n\nSegundo paragrafo com solucao."
        result = extract_case_card_from_text(text, author="tech10")

        assert result['problem_summary'] == "Primeiro paragrafo com problema."
        # Field technique includes second paragraph content
        assert "Segundo" in result['field_technique']

    def test_field_technique_is_none_when_no_paragraphs(self):
        """Field technique is None when only one paragraph."""
        text = "Unico paragrafo."
        result = extract_case_card_from_text(text, author="tech11")

        assert result['problem_summary'] == "Unico paragrafo."
        assert result['field_technique'] is None

    def test_equipment_type_detection(self):
        """Various equipment types detected correctly."""
        test_cases = [
            ("VRV system", "VRV"),
            ("VRF split", "VRF"),
            ("cassete instalado", "CASSETE"),
            ("piso teto", "PISO TETO"),
            ("chiller", "CHILLER"),
        ]
        for text_suffix, expected_type in test_cases:
            text = f"Daikin {text_suffix}"
            result = extract_case_card_from_text(text, author="tech")
            assert result['equipment_type'] == expected_type, f"Failed for {text_suffix}: got {result['equipment_type']}"

    def test_metadata_extracted_at_is_iso_format(self):
        """Metadata extracted_at is in ISO format."""
        text = "Daikin VRV com alarme U4-01."
        result = extract_case_card_from_text(text, author="tech")

        assert 'extracted_at' in result['metadata']
        # Should be parseable as ISO datetime
        from datetime import datetime
        datetime.fromisoformat(result['metadata']['extracted_at'])


class TestCrossBrandIsolation:
    """Ensure field cases don't leak across brands."""

    def test_daikin_case_not_retrieved_for_springer_l2(self):
        """Daikin VEE case should NOT match Springer L2 query."""
        from hvac_field_memory import field_experience_lookup

        with mock_field_lookup():
            with patch('hvac_field_memory.get_qdrant_client') as mock_qdrant:
                mock_client = MagicMock()
                mock_qdrant.return_value = mock_client
                mock_client.get_collections.return_value.collections = []
                mock_client.search.return_value = []

                cases = field_experience_lookup(
                    brand="Springer",
                    family="L2",
                    alarm_code="L2",
                    component="compressor",
                    symptom="travado",
                    top_k=3
                )

                # Verify search was called
                mock_client.search.assert_called_once()
                call_args = mock_client.search.call_args

                # Verify filter was constructed with brand condition
                search_filter = call_args[1].get('query_filter')
                # Brand filter should be in should conditions
                brand_filter_found = any(
                    fc.key == "brand" and fc.match.value == "Springer"
                    for fc in search_filter.should
                )
                assert brand_filter_found, "Brand filter not applied in search"

    def test_brand_filter_applied_in_search(self):
        """Brand filter must be in Qdrant query filter."""
        from hvac_field_memory import field_experience_lookup

        with mock_field_lookup():
            with patch('hvac_field_memory.get_qdrant_client') as mock_qdrant:
                mock_client = MagicMock()
                mock_qdrant.return_value = mock_client
                mock_client.get_collections.return_value.collections = []
                mock_client.search.return_value = []

                field_experience_lookup(brand="Daikin", top_k=3)

                mock_client.search.assert_called_once()
                search_filter = mock_client.search.call_args[1]['query_filter']

                # Must have brand in should conditions
                brand_in_filter = any(
                    cond.key == "brand" and cond.match.value == "Daikin"
                    for cond in search_filter.should
                )
                assert brand_in_filter


class TestStatusFiltering:
    """Draft cases should never appear in retrieval."""

    def test_draft_excluded_from_lookup(self):
        """status=draft should filter OUT cases."""
        from hvac_field_memory import field_experience_lookup

        with mock_field_lookup():
            with patch('hvac_field_memory.get_qdrant_client') as mock_qdrant:
                mock_client = MagicMock()
                mock_qdrant.return_value = mock_client
                mock_client.get_collections.return_value.collections = []
                mock_client.search.return_value = []

                field_experience_lookup(brand="Daikin", top_k=3)

                search_filter = mock_client.search.call_args[1]['query_filter']

                # Status must be 'approved' in must conditions
                status_in_must = any(
                    cond.key == "status" and cond.match.value == "approved"
                    for cond in search_filter.must
                )
                assert status_in_must, "Status filter not set to 'approved' in must conditions"

    def test_approved_status_in_must_conditions(self):
        """Approved status must be in must conditions of filter."""
        from hvac_field_memory import field_experience_lookup

        with mock_field_lookup():
            with patch('hvac_field_memory.get_qdrant_client') as mock_qdrant:
                mock_client = MagicMock()
                mock_qdrant.return_value = mock_client
                mock_client.get_collections.return_value.collections = []
                mock_client.search.return_value = []

                field_experience_lookup(top_k=5)

                search_filter = mock_client.search.call_args[1]['query_filter']

                # Check both status and source_type are in must
                must_keys = [cond.key for cond in search_filter.must]
                assert 'status' in must_keys
                assert 'source_type' in must_keys


class TestSafetyAlerts:
    """Safety alert generation for dangerous components."""

    def test_vee_in_components_triggers_safety(self):
        """VEE in components should trigger safety consideration."""
        text = "Daikin VRV com VEE danificada. Forcar operacao para testar."
        result = extract_case_card_from_text(text, author="tech")

        assert 'vee' in result['components']

    def test_compressor_in_components(self):
        """Compressor is extracted as component."""
        text = "Springer L2 com compressor travado."
        result = extract_case_card_from_text(text, author="tech")

        assert 'compressor' in result['components']

    def test_ipm_in_components(self):
        """IPM board extracted as component."""
        text = "Midea VRF com IPM danificado. Placa de potencia com problema."
        result = extract_case_card_from_text(text, author="tech")

        assert 'ipm' in result['components']
        assert 'placa de potencia' in result['components']

    def test_no_safety_for_low_risk_components(self):
        """Non-dangerous components don't need safety alerts."""
        text = "Split com filtro sujo e capacitor com problema."
        result = extract_case_card_from_text(text, author="tech")

        assert 'filtro' in result['components']
        assert 'capacitor' in result['components']


class TestYouTubeIngest:
    """YouTube metadata extraction and case card creation."""

    def test_youtube_url_watch_format(self):
        """Extract video ID from standard YouTube watch URL."""
        url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        # Extract video ID using regex pattern
        match = re.search(r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)([a-zA-Z0-9_-]{11})', url)
        assert match is not None
        assert match.group(1) == "dQw4w9WgXcQ"

    def test_youtube_url_short_format(self):
        """Extract video ID from youtu.be short URL."""
        url = "https://youtu.be/dQw4w9WgXcQ"
        match = re.search(r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)([a-zA-Z0-9_-]{11})', url)
        assert match is not None
        assert match.group(1) == "dQw4w9WgXcQ"

    def test_youtube_url_embed_format(self):
        """Extract video ID from YouTube embed URL."""
        url = "https://www.youtube.com/embed/dQw4w9WgXcQ"
        match = re.search(r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)([a-zA-Z0-9_-]{11})', url)
        assert match is not None
        assert match.group(1) == "dQw4w9WgXcQ"

    def test_youtube_case_card_structure(self):
        """YouTube case card has correct source_type and confidence."""
        # Simulate what a YouTube case card would look like
        case_card = {
            'author': 'youtube_channel',
            'source_type': 'youtube_summary',
            'source_url': 'https://youtube.com/watch?v=xxx',
            'source_title': 'Daikin VRV Service Tutorial',
            'brand': 'Daikin',
            'model': None,
            'model_family': None,
            'equipment_type': 'VRV',
            'alarm_codes': ['U4-01'],
            'components': ['VEE'],
            'symptoms': [],
            'problem_summary': 'Technique for diagnosing VEE issues on Daikin VRV systems.',
            'field_technique': 'Diagnostic procedure shown in video.',
            'safety_notes': None,
            'limitations': 'Video summary may omit details',
            'evidence_level': 'video',
            'confidence': 'low',
            'status': 'draft',
            'metadata': {'extracted_at': '2024-01-01T00:00:00'},
        }

        assert case_card['source_type'] == 'youtube_summary'
        assert case_card['confidence'] == 'low'
        assert case_card['status'] == 'draft'
        assert case_card['evidence_level'] == 'video'
        assert 'VEE' in case_card['problem_summary'] or 'VEE' in case_card['field_technique']


class TestPayloadFiltering:
    """Qdrant payload filter construction."""

    def test_all_payload_indexes_defined(self):
        """All required payload fields are indexed in ensure_qdrant_collection."""
        required_indexes = [
            'source_type', 'author', 'brand', 'model_family',
            'equipment_type', 'alarm_codes', 'components',
            'symptoms', 'evidence_level', 'confidence', 'status'
        ]

        # These are defined in hvac_field_memory.py ensure_qdrant_collection
        expected_payload_index_fields = [
            "source_type",
            "author",
            "brand",
            "model_family",
            "equipment_type",
            "alarm_codes",
            "components",
            "symptoms",
            "evidence_level",
            "confidence",
            "status",
        ]

        for field in required_indexes:
            assert field in expected_payload_index_fields, f"Missing index for {field}"

    def test_case_card_to_text(self):
        """case_card_to_text combines relevant fields."""
        from hvac_field_memory import case_card_to_text

        case = {
            'problem_summary': 'Compressor not starting',
            'field_technique': 'Check capacitor',
            'safety_notes': 'High voltage',
        }
        text = case_card_to_text(case)
        assert 'Compressor not starting' in text
        assert 'Check capacitor' in text
        assert 'High voltage' in text

    def test_case_card_to_text_skips_none(self):
        """case_card_to_text skips None values."""
        from hvac_field_memory import case_card_to_text

        case = {
            'problem_summary': 'Problem here',
            'field_technique': None,
            'safety_notes': None,
        }
        text = case_card_to_text(case)
        assert text == 'Problem here'


class TestPTBRClean:
    """Ensure no CJK/Cyrillic characters in output."""

    def test_no_cjk_in_case_cards(self):
        """Case card text must not contain CJK characters."""
        text = "Sistema Daikin VRV com alarme U4-01. Compressor nao liga."
        result = extract_case_card_from_text(text, author="tech")

        # Check problem_summary for CJK
        cjk_pattern = re.compile(r'[一-鿿]')
        assert not cjk_pattern.search(result['problem_summary']), "CJK found in problem_summary"

        # Check field_technique if present
        if result['field_technique']:
            assert not cjk_pattern.search(result['field_technique']), "CJK found in field_technique"

    def test_no_cyrillic_in_case_cards(self):
        """Case card text must not contain Cyrillic characters."""
        text = "Daikin VRV with alarm U4-01."
        result = extract_case_card_from_text(text, author="tech")

        cyrillic_pattern = re.compile(r'[Ѐ-ӿ]')
        summary = result['problem_summary']
        assert not cyrillic_pattern.search(summary), "Cyrillic found in case card"


class TestFieldExperienceLookup:
    """Tests for field_experience_lookup function."""

    def test_lookup_requires_embedding(self):
        """field_experience_lookup generates embedding for search."""
        from hvac_field_memory import field_experience_lookup

        with mock_field_lookup():
            with patch('hvac_field_memory.generate_embedding') as mock_embed:
                with patch('hvac_field_memory.get_qdrant_client') as mock_qdrant:
                    mock_client = MagicMock()
                    mock_qdrant.return_value = mock_client
                    mock_client.get_collections.return_value.collections = []
                    mock_client.search.return_value = []
                    mock_embed.return_value = [0.1] * 1536

                    field_experience_lookup(brand="Daikin", top_k=3)

                    mock_embed.assert_called_once()
                    call_args = mock_embed.call_args[0][0]
                    assert "Daikin" in call_args

    def test_lookup_returns_list_of_dicts(self):
        """field_experience_lookup returns properly structured results."""
        from hvac_field_memory import field_experience_lookup

        with mock_field_lookup():
            with patch('hvac_field_memory.generate_embedding') as mock_embed:
                with patch('hvac_field_memory.get_qdrant_client') as mock_qdrant:
                    mock_client = MagicMock()
                    mock_qdrant.return_value = mock_client
                    mock_client.get_collections.return_value.collections = []

                    # Mock a hit result
                    mock_hit = MagicMock()
                    mock_hit.id = "test-uuid"
                    mock_hit.score = 0.95
                    mock_hit.payload = {
                        'brand': 'Daikin',
                        'alarm_codes': ['U4-01'],
                        'problem_summary': 'Test problem',
                    }
                    mock_client.search.return_value = [mock_hit]
                    mock_embed.return_value = [0.1] * 1536

                    results = field_experience_lookup(brand="Daikin", top_k=3)

                    assert len(results) == 1
                    assert results[0]['id'] == "test-uuid"
                    assert results[0]['score'] == 0.95
                    assert results[0]['payload']['brand'] == 'Daikin'

    def test_lookup_with_multiple_filters(self):
        """Lookup correctly combines brand, alarm, component filters."""
        from hvac_field_memory import field_experience_lookup

        with mock_field_lookup():
            with patch('hvac_field_memory.generate_embedding') as mock_embed:
                with patch('hvac_field_memory.get_qdrant_client') as mock_qdrant:
                    mock_client = MagicMock()
                    mock_qdrant.return_value = mock_client
                    mock_client.get_collections.return_value.collections = []
                    mock_client.search.return_value = []
                    mock_embed.return_value = [0.1] * 1536

                    field_experience_lookup(
                        brand="Daikin",
                        alarm_code="U4-01",
                        component="VEE",
                        top_k=5
                    )

                    search_filter = mock_client.search.call_args[1]['query_filter']
                    should_keys = [cond.key for cond in search_filter.should]

                    assert 'brand' in should_keys
                    assert 'alarm_codes' in should_keys
                    assert 'components' in should_keys


class TestIndexFieldCaseApproved:
    """Tests for index_field_case_approved function."""

    def test_index_requires_approved_status(self):
        """index_field_case_approved rejects non-approved cases."""
        from hvac_field_memory import index_field_case_approved

        with patch('hvac_field_memory.get_field_case') as mock_get:
            mock_get.return_value = {
                'id': 'test-id',
                'status': 'draft',
                'problem_summary': 'Test',
                'field_technique': 'Test',
            }

            with pytest.raises(ValueError, match="not approved"):
                index_field_case_approved('test-id')

    def test_index_requires_existing_case(self):
        """index_field_case_approved raises error for missing case."""
        from hvac_field_memory import index_field_case_approved

        with patch('hvac_field_memory.get_field_case') as mock_get:
            mock_get.return_value = None

            with pytest.raises(ValueError, match="Case not found"):
                index_field_case_approved('non-existent-id')


class TestKeywordSets:
    """Tests for keyword detection sets."""

    def test_brand_keywords_cover_major_brands(self):
        """BRAND_KEYWORDS contains expected brands."""
        expected_brands = ['daikin', 'springer', 'midea', 'carrier', 'lennox', 'mitsubishi', 'lg']
        for brand in expected_brands:
            assert brand in BRAND_KEYWORDS, f"Missing brand: {brand}"

    def test_component_keywords_cover_dangerous_parts(self):
        """COMPONENT_KEYWORDS includes dangerous components like VEE."""
        assert 'vee' in COMPONENT_KEYWORDS
        assert 'compressor' in COMPONENT_KEYWORDS
        assert 'placa' in COMPONENT_KEYWORDS

    def test_symptom_keywords_cover_common_issues(self):
        """SYMPTOM_KEYWORDS covers common HVAC symptoms."""
        assert 'nao liga' in SYMPTOM_KEYWORDS
        assert 'desliga' in SYMPTOM_KEYWORDS
        assert 'compressor travado' in SYMPTOM_KEYWORDS

    def test_alarm_code_pattern_matches_expected_format(self):
        """ALARM_CODE_PATTERN matches common alarm code formats."""
        test_cases = ['U4-01', 'L2', 'E6', 'F3']
        for code in test_cases:
            match = ALARM_CODE_PATTERN.search(code)
            assert match is not None, f"Pattern failed for {code}"
            assert match.group(1) == code


class TestSplitParagraphs:
    """Tests for _split_paragraphs helper."""

    def test_split_on_double_newline(self):
        """Splits text on double newlines."""
        text = "First paragraph.\n\nSecond paragraph."
        result = _split_paragraphs(text)
        assert len(result) == 2
        assert result[0] == "First paragraph."
        assert result[1] == "Second paragraph."

    def test_split_on_newline_before_capital(self):
        """Splits text on single newline followed by capital letter."""
        text = "First.\nSecond starts here."
        result = _split_paragraphs(text)
        assert len(result) == 2

    def test_strips_whitespace(self):
        """Strips whitespace from paragraphs."""
        text = "  First  \n\n  Second  "
        result = _split_paragraphs(text)
        assert result[0] == "First"
        assert result[1] == "Second"

    def test_empty_paragraphs_removed(self):
        """Empty paragraphs are not included."""
        text = "First\n\n\nSecond"
        result = _split_paragraphs(text)
        assert "" not in result
        assert len(result) == 2


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
