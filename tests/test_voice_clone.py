#!/usr/bin/env python3
"""
SPEC-076: Voice Clone A/B Test — Kokoro vs XTTS v2
Trava-línguas PT-BR para avaliar qualidade de voice cloning
"""
import os
import sys

# Use Python 3.11 venv
VENV_BIN = "/srv/monorepo/.xtts-venv/bin/python3"

# Trava-línguas PT-BR (pior caso para síntese)
TRAVA_LINGUA = "O rato roeu a roupa do rei de Roma e a rainha com raiva resolveu remendar."

FRASE_COMPLEXA = (
    "A inteligência artificial está a transformar a forma como interagimos "
    "com a tecnologia. Com avanços cada vez mais rápidos, podemos esperar "
    "que nos próximos anos vejamos aplicações ainda mais impressionantes."
)

REFERENCE_ZAPRO = "/srv/monorepo/will_voice_ZapPro.wav"
REFERENCE_JARVIS = "/srv/monorepo/will_voice_Jarvis_home_lab.wav"

def check_xtts():
    """Check if XTTS v2 works after PyTorch downgrade."""
    try:
        from TTS.api import TTS
        tts = TTS("xtts_v2")
        print("✅ XTTS v2 loaded successfully")
        return tts
    except Exception as e:
        print(f"❌ XTTS v2 failed: {e}")
        return None

def test_xtts_clone(tts, text, reference_audio, output_file):
    """Generate XTTS clone with given reference audio."""
    try:
        tts.tts_to_file(
            text=text,
            speaker_wav=reference_audio,
            file_path=output_file
        )
        print(f"✅ XTTS clone generated: {output_file}")
        return True
    except Exception as e:
        print(f"❌ XTTS clone failed: {e}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("SPEC-076: Voice Clone A/B Test")
    print("=" * 60)

    tts = check_xtts()

    if tts:
        # Test 1: Short trava-línguas with ZapPro reference
        test_xtts_clone(tts, TRAVA_LINGUA, REFERENCE_ZAPRO,
                        "/srv/monorepo/xtts_zappro_trava.wav")

        # Test 2: Complex phrase with ZapPro reference
        test_xtts_clone(tts, FRASE_COMPLEXA, REFERENCE_ZAPRO,
                        "/srv/monorepo/xtts_zappro_frase.wav")

        # Test 3: Short trava-línguas with Jarvis reference
        test_xtts_clone(tts, TRAVA_LINGUA, REFERENCE_JARVIS,
                        "/srv/monorepo/xtts_jarvis_trava.wav")
    else:
        print("\n⚠️  Install PyTorch 2.5: pip install 'torch==2.5.1'")
        sys.exit(1)
