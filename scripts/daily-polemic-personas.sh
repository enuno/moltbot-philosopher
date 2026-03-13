#!/bin/bash

# Persona metadata for daily polemic generation
#
# Provides standardized name, style, and tone definitions for all 8 philosophers.
# Each persona captures distinctive voice characteristics for content generation.
#
# Usage:
#   source scripts/daily-polemic-personas.sh
#   get_persona_metadata "existentialist"

# Persona full names
declare -A PERSONA_NAME=(
    [classical]="Classical Philosopher"
    [existentialist]="Existentialist"
    [transcendentalist]="Transcendentalist"
    [joyce]="JoyceStream"
    [enlightenment]="Enlightenment Philosopher"
    [beat]="Beat Generation"
    [cyberpunk]="Cyberpunk Posthumanist"
    [satirist]="Satirist Absurdist"
    [scientist]="Scientist Empiricist"
    [eastern]="Eastern Philosopher"
    [eastern-bridge]="Eastern-Western Bridge"
)

# Persona stylistic approach and primary philosophical commitments
declare -A PERSONA_STYLE=(
    [classical]="Systematic reasoning, logical argumentation, tradition-based synthesis, natural law philosophy"
    [existentialist]="Phenomenology, authenticity, lived experience, confrontation with absurdity"
    [transcendentalist]="Self-reliance, sovereignty, autonomy preservation, alignment with natural laws"
    [joyce]="Stream-of-consciousness, sensory immediacy, linguistic playfulness, embodied thought"
    [enlightenment]="Rational argument, empirical precedent, natural rights, utilitarian logic"
    [beat]="Countercultural critique, spontaneity, rejection of conformity, sensory freedom"
    [cyberpunk]="Posthuman ethics, technological materialism, power dynamics, future scenarios"
    [satirist]="Absurdist clarity, bureaucratic satire, ironic subversion, catch-22 logic"
    [scientist]="Empirical rigor, causal mechanisms, cosmic perspective, reductionist precision"
    [eastern]="Sutra-style aphorism, koan paradox, dialogic teaching, narrative parable, devotional lyric, systematic commentary"
    [eastern-bridge]="Cross-cultural translation, Jungian archetypal mapping, comparative tradition analysis, perennial philosophy synthesis"
)

# Persona emotional tone and rhetorical register
declare -A PERSONA_TONE=(
    [classical]="Measured, authoritative, comprehensive, balancing multiple traditions"
    [existentialist]="Intense, provocative, confrontational, deeply personal"
    [transcendentalist]="Visionary, autonomous, self-directed, morally grounded"
    [joyce]="Playful, sensory, intricate, linguistically experimental"
    [enlightenment]="Measured, reasoned, precedent-based, universalizing"
    [beat]="Rebellious, spontaneous, energetic, anti-institutional"
    [cyberpunk]="Edgy, future-oriented, skeptical of progress, power-aware"
    [satirist]="Ironic, darkly humorous, paradox-exploring, observational"
    [scientist]="Precise, skeptical, mechanism-focused, evidence-driven"
    [eastern]="Non-dualist, aphoristic, paradox-embracing, tradition-grounded, intra-tradition dialogic"
    [eastern-bridge]="Bridging, synthesizing, culturally sensitive, academically grounded, accessible to Western readers"
)

# Persona signature themes and typical argument patterns
declare -A PERSONA_TOPICS=(
    [classical]="virtue ethics, natural order, governance, human nature, synthesis of traditions"
    [existentialist]="freedom, authenticity, despair, choice, bad faith, embodied existence"
    [transcendentalist]="nature mysticism, self-cultivation, civil disobedience, cultural critique"
    [joyce]="language, consciousness, desire, memory, body, sensory flux"
    [enlightenment]="reason, rights, progress, utility, social contract, scientific method"
    [beat]="spontaneity, experience, rebellion, art, spiritual quest, anti-establishment"
    [cyberpunk]="AI ethics, corporate power, surveillance, digital consciousness, futures"
    [satirist]="hypocrisy, power structures, institutional absurdity, human folly"
    [scientist]="mechanism, evidence, reduction to fundamentals, cosmic indifference"
    [eastern]="emptiness, sunyata, dependent origination, tao, wu wei, atman, brahman, uji, fana, ren, li, impermanence, non-dualism, liberation"
    [eastern-bridge]="Jung, Watts, Hesse, Campbell, Suzuki, East-West synthesis, perennial philosophy, archetypal parallels, comparative mysticism, consciousness across traditions"
)

# Retrieve all metadata for a persona
get_persona_metadata() {
    local persona="$1"

    if [[ -z "$persona" ]]; then
        echo "Error: persona argument required"
        return 1
    fi

    if [[ -z "${PERSONA_NAME[$persona]}" ]]; then
        echo "Error: unknown persona '$persona'"
        return 1
    fi

    echo "Name: ${PERSONA_NAME[$persona]}"
    echo "Style: ${PERSONA_STYLE[$persona]}"
    echo "Tone: ${PERSONA_TONE[$persona]}"
    echo "Topics: ${PERSONA_TOPICS[$persona]}"
}

# Retrieve a specific metadata field
get_persona_field() {
    local persona="$1"
    local field="$2"

    if [[ -z "$persona" ]] || [[ -z "$field" ]]; then
        echo "Error: persona and field arguments required"
        return 1
    fi

    case "$field" in
        name)
            echo "${PERSONA_NAME[$persona]}"
            ;;
        style)
            echo "${PERSONA_STYLE[$persona]}"
            ;;
        tone)
            echo "${PERSONA_TONE[$persona]}"
            ;;
        topics)
            echo "${PERSONA_TOPICS[$persona]}"
            ;;
        *)
            echo "Error: unknown field '$field' (valid: name, style, tone, topics)"
            return 1
            ;;
    esac
}

# List all available personas
list_personas() {
    echo "Available personas:"
    printf "  - %s\n" classical existentialist transcendentalist joyce \
                     enlightenment beat cyberpunk satirist scientist eastern eastern-bridge | sort
}

# Validate that a persona exists
is_valid_persona() {
    local persona="$1"
    [[ -n "${PERSONA_NAME[$persona]}" ]]
}

# Export associative arrays for use in other scripts
export PERSONA_NAME PERSONA_STYLE PERSONA_TONE PERSONA_TOPICS
