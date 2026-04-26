#!/bin/bash
# fit.sh — Fitness Tracker MVP
# Musculacao, Dieta, Agua, Suplementos, Manipulados

FIT_DIR="${FIT_DIR:-$HOME/.fit-tracker}"
DATA_DIR="$FIT_DIR/data"
mkdir -p "$DATA_DIR"

WORKOUT_FILE="$DATA_DIR/workout.json"
DIET_FILE="$DATA_DIR/diet.json"
WATER_FILE="$DATA_DIR/water.json"
SUPP_FILE="$DATA_DIR/supplements.json"
MANIP_FILE="$DATA_DIR/manipulados.json"

WATER_GOAL=3000
CAL_GOAL=2500

init() {
  [ ! -f "$WORKOUT_FILE" ] && echo '{"exercises":[]}' > "$WORKOUT_FILE"
  [ ! -f "$DIET_FILE" ] && echo '{"meals":[]}' > "$DIET_FILE"
  [ ! -f "$WATER_FILE" ] && echo '{"ml":0,"goal":3000}' > "$WATER_FILE"
  [ ! -f "$SUPP_FILE" ] && echo '{"supplements":[]}' > "$SUPP_FILE"
  [ ! -f "$MANIP_FILE" ] && echo '{"meds":[]}' > "$MANIP_FILE"
}

# Treino
treino_add() {
  local name="$1"; local muscle="$2"; local sets="$3"; local reps="$4"; local weight="$5"
  local id=$(date +%s)
  local new_entry="{\"id\":$id,\"name\":\"$name\",\"muscle\":\"$muscle\",\"sets\":$sets,\"reps\":$reps,\"weight\":$weight,\"done\":false}"
  jq ".exercises += [$new_entry]" "$WORKOUT_FILE" > /tmp/w.json && mv /tmp/w.json "$WORKOUT_FILE"
  echo "Treino: $name added"
}

treino_done() {
  local id="$1"
  jq "(.exercises[] | select(.id == $id)).done = true" "$WORKOUT_FILE" > /tmp/w.json && mv /tmp/w.json "$WORKOUT_FILE"
  echo "Done: $id"
}

# Dieta
dieta_add() {
  local meal="$1"; local food="$2"; local cal="$3"; local prot="$4"; local carb="$5"; local fat="$6"
  local id=$(date +%s)
  local new_entry="{\"id\":$id,\"meal\":\"$meal\",\"food\":\"$food\",\"cal\":$cal,\"prot\":$prot,\"carb\":$carb,\"fat\":$fat}"
  jq ".meals += [$new_entry]" "$DIET_FILE" > /tmp/d.json && mv /tmp/d.json "$DIET_FILE"
  echo "Dieta: $food added"
}

# Agua
agua_log() {
  local ml="$1"
  local current=$(jq '.ml' "$WATER_FILE")
  local new=$((current + ml))
  jq ".ml = $new" "$WATER_FILE" > /tmp/a.json && mv /tmp/a.json "$WATER_FILE"
  echo "Agua: +${ml}ml (total: ${new}ml)"
}

# Suplementos
supp_add() {
  local name="$1"; local dose="$2"; local time="$3"
  local id=$(date +%s)
  local new_entry="{\"id\":$id,\"name\":\"$name\",\"dose\":\"$dose\",\"time\":\"$time\",\"taken\":false}"
  jq ".supplements += [$new_entry]" "$SUPP_FILE" > /tmp/s.json && mv /tmp/s.json "$SUPP_FILE"
  echo "Supp: $name added"
}

supp_take() {
  local id="$1"
  jq "(.supplements[] | select(.id == $id)).taken = true" "$SUPP_FILE" > /tmp/s.json && mv /tmp/s.json "$SUPP_FILE"
  echo "Taken: $id"
}

# Manipulados
manip_add() {
  local name="$1"; local dose="$2"; local freq="$3"; local stock="$4"
  local id=$(date +%s)
  local new_entry="{\"id\":$id,\"name\":\"$name\",\"dose\":\"$dose\",\"freq\":\"$freq\",\"stock\":$stock}"
  jq ".meds += [$new_entry]" "$MANIP_FILE" > /tmp/m.json && mv /tmp/m.json "$MANIP_FILE"
  echo "Manip: $name added"
}

# Dashboard
dash() {
  echo ""
  echo "=== FIT TRACKER MVP ==="
  echo "Date: $(date +%d/%m/%Y)"
  echo ""
  echo "--- AGUA ---"
  echo "💧 $(jq '.ml' "$WATER_FILE")ml / $(jq '.goal' "$WATER_FILE")ml"
  echo ""
  echo "--- DIETA ---"
  local total=$(jq '[.meals[].cal] | add // 0' "$DIET_FILE")
  echo "Calorias: ${total}cal / ${CAL_GOAL}cal"
  echo ""
  echo "--- SUPLEMENTOS ---"
  jq -r '.supplements[] | "\(.name) \(.dose) - \(.time)"' "$SUPP_FILE" 2>/dev/null || echo "Nenhum"
  echo ""
  echo "--- MANIPULADOS ---"
  jq -r '.meds[] | "\(.name) \(.dose) - \(.freq) (stock: \(.stock))"' "$MANIP_FILE" 2>/dev/null || echo "Nenhum"
  echo ""
  echo "--- TREINO ---"
  jq -r '.exercises[] | "\(.name) | \(.muscle) | \(.sets)x\(.reps) @ \(.weight)kg" + (if .done then " [DONE]" else "" end)' "$WORKOUT_FILE" 2>/dev/null || echo "Nenhum"
  echo ""
}

init

case "$1" in
  d| dash) dash ;;
  t| treino)
    case "$2" in
      add) treino_add "$3" "$4" "$5" "$6" "$7" ;;
      done) treino_done "$3" ;;
      *) echo "Usage: fit.sh treino {add|done}" ;;
    esac ;;
  diet| dieta)
    case "$2" in
      add) dieta_add "$3" "$4" "$5" "$6" "$7" "$8" ;;
      *) echo "Usage: fit.sh dieta add" ;;
    esac ;;
  a| agua) agua_log "${2:-500}" ;;
  s| supp)
    case "$2" in
      add) supp_add "$3" "$4" "$5" ;;
      take) supp_take "$3" ;;
      *) echo "Usage: fit.sh supp {add|take}" ;;
    esac ;;
  m| manip)
    case "$2" in
      add) manip_add "$3" "$4" "$5" "$6" ;;
      *) echo "Usage: fit.sh manip add" ;;
    esac ;;
  *) dash ;;
esac
