#!/bin/bash

TRACKS=(
  "python" "javascript" "typescript" "java" "c" "cpp" "ruby" "go" "rust"
  "csharp" "php" "swift" "kotlin" "scala" "elixir" "haskell" "lua" "r"
  "julia" "perl" "clojure" "fsharp" "ocaml" "erlang" "zig" "nim" "crystal"
)

DATA_DIR="./data"
mkdir -p $DATA_DIR

for track in "${TRACKS[@]}"; do
  echo "Cloning exercism/$track..."
  if [ -d "$DATA_DIR/$track" ]; then
    echo "  Already exists, pulling latest..."
    cd "$DATA_DIR/$track" && git pull && cd ../..
  else
    git clone --depth 1 "https://github.com/exercism/$track.git" "$DATA_DIR/$track"
  fi
done

echo "Done! All tracks cloned."
