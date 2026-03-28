pub(super) fn bash_shell_integration_script() -> &'static str {
    r#"if [ -n "${BASH_VERSION-}" ]; then
eval "$(cat <<'__VORTIX_BASH__'
if [ -z "${__vortix_shell_integration_ready-}" ]; then
__vortix_shell_integration_ready=1
__vortix_last_history_id=
__vortix_current_command=
__vortix_in_precmd=0

__vortix_escape_value_fast() {
  local LC_ALL=C out
  out=${1//\\/\\\\}
  out=${out//;/\\x3b}
  printf '%s' "$out"
}

__vortix_escape_value() {
  if [ "${#1}" -ge 2000 ]; then
    __vortix_escape_value_fast "$1"
    return 0
  fi
  local -r LC_ALL=C
  local -r str="${1}"
  local -ir len="${#str}"
  local -i i
  local -i val
  local byte token out=''
  for (( i=0; i < len; ++i )); do
    byte="${str:$i:1}"
    printf -v val '%d' "'$byte"
    if (( val < 32 )); then
      printf -v token '\\x%02x' "$val"
    elif (( val == 92 )); then
      token="\\\\"
    elif (( val == 59 )); then
      token="\\x3b"
    else
      token="$byte"
    fi
    out+="$token"
  done
  printf '%s' "$out"
}

__vortix_emit_osc() {
  printf '\033]633;%s\a' "$1"
}

__vortix_read_history_entry() {
  local entry
  entry="$(builtin history 1 2>/dev/null)" || return 1
  [[ "$entry" =~ ^[[:space:]]*([0-9]+)[[:space:]]+(.*)$ ]] || return 1
  printf '%s\t%s' "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"
}

__vortix_update_history_id() {
  local entry
  entry="$(__vortix_read_history_entry)" || return 0
  __vortix_last_history_id="${entry%%$'\t'*}"
}

__vortix_preexec() {
  [[ "${__vortix_in_precmd:-0}" -eq 1 ]] && return
  local entry history_id cmd
  entry="$(__vortix_read_history_entry)" || return
  history_id="${entry%%$'\t'*}"
  cmd="${entry#*$'\t'}"
  if [[ -z "$history_id" || "$history_id" == "${__vortix_last_history_id-}" ]]; then
    return
  fi
  __vortix_last_history_id="$history_id"
  if [[ -z "$cmd" || "$cmd" == *"__vortix_"* ]]; then
    __vortix_current_command=
    return
  fi
  __vortix_current_command="$cmd"
  __vortix_emit_osc "E;$(__vortix_escape_value "$cmd")"
}

__vortix_precmd() {
  local ec=$?
  __vortix_in_precmd=1
  builtin history -a 2>/dev/null
  if [[ -z "${__vortix_ready_sent-}" ]]; then
    __vortix_emit_osc "P;VortixShell=Ready"
    __vortix_ready_sent=1
  fi
  __vortix_emit_osc "P;Cwd=$(__vortix_escape_value "$PWD")"
  if [[ -n "${__vortix_current_command-}" ]]; then
    __vortix_emit_osc "D;$ec"
  else
    __vortix_emit_osc "D"
  fi
  __vortix_current_command=
  __vortix_update_history_id
  __vortix_in_precmd=0
  return "$ec"
}

case "${PS0-}" in
  *'$(__vortix_preexec)'*) ;;
  *) PS0='$(__vortix_preexec)'"${PS0-}" ;;
esac

case "$(declare -p PROMPT_COMMAND 2>/dev/null)" in
  "declare -a"*)
    __vortix_has_precmd=0
    for __vortix_prompt_cmd in "${PROMPT_COMMAND[@]}"; do
      if [[ "$__vortix_prompt_cmd" == "__vortix_precmd" ]]; then
        __vortix_has_precmd=1
        break
      fi
    done
    if [[ "$__vortix_has_precmd" -eq 0 ]]; then
      PROMPT_COMMAND=(__vortix_precmd "${PROMPT_COMMAND[@]}")
    fi
    unset __vortix_has_precmd __vortix_prompt_cmd
    ;;
  *)
    case ";${PROMPT_COMMAND-};" in
      *";__vortix_precmd;"*) ;;
      *)
        if [ -n "${PROMPT_COMMAND-}" ]; then
          PROMPT_COMMAND="__vortix_precmd;$PROMPT_COMMAND"
        else
          PROMPT_COMMAND="__vortix_precmd"
        fi
        ;;
    esac
    ;;
esac

__vortix_update_history_id
fi
__VORTIX_BASH__
)"
fi
"#
}
