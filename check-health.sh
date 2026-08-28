#!/usr/bin/env bash
# Health check for urguteats.com on GitHub Pages.
# Run after any DNS or Cloudflare change: bash check-health.sh
# Exit code 0 = everything green, 1 = at least one problem found.

set -uo pipefail
DOMAIN="urguteats.com"
FAIL=0
ok()   { printf "  \033[32mOK\033[0m    %s\n" "$1"; }
bad()  { printf "  \033[31mFAIL\033[0m  %s\n" "$1"; FAIL=1; }
warn() { printf "  \033[33mWARN\033[0m  %s\n" "$1"; }

# GitHub Pages apex addresses, per `gh api meta --jq '.pages[]'`.
# The IPv6 block increments (8000/8001/8002/8003); the suffix is always ::153.
EXPECTED_A="185.199.108.153 185.199.109.153 185.199.110.153 185.199.111.153"
EXPECTED_AAAA="2606:50c0:8000::153 2606:50c0:8001::153 2606:50c0:8002::153 2606:50c0:8003::153"

echo
echo "== DNS =="

GOT_A=$(dig +short A "$DOMAIN" | sort | tr '\n' ' ')
for ip in $EXPECTED_A; do
  case " $GOT_A " in *" $ip "*) ok "A $ip" ;; *) bad "A $ip отсутствует" ;; esac
done
for ip in $GOT_A; do
  case " $EXPECTED_A " in *" $ip "*) ;; *) bad "A $ip лишний, не принадлежит GitHub Pages" ;; esac
done

GOT_AAAA=$(dig +short AAAA "$DOMAIN" | sort | tr '\n' ' ')
if [ -z "$(echo "$GOT_AAAA" | tr -d ' ')" ]; then
  warn "AAAA-записей нет: IPv6-посетители пойдут по IPv4. Допустимо, но лучше завести правильные."
else
  for ip in $EXPECTED_AAAA; do
    case " $GOT_AAAA " in *" $ip "*) ok "AAAA $ip" ;; *) warn "AAAA $ip отсутствует" ;; esac
  done
  for ip in $GOT_AAAA; do
    case " $EXPECTED_AAAA " in
      *" $ip "*) ;;
      *) bad "AAAA $ip НЕ является эндпоинтом GitHub Pages: IPv6-посетители получат ошибку сертификата" ;;
    esac
  done
fi

echo
echo "== Проксирование Cloudflare =="
HDRS=$(curl -sI -m 20 "https://$DOMAIN/" || true)
if grep -qi "^cf-ray:" <<<"$HDRS"; then
  warn "Оранжевое облако ВКЛЮЧЕНО. Режим SSL/TLS обязан быть Full (strict), иначе будет цикл редиректов."
else
  if grep -qi "^server: GitHub.com" <<<"$HDRS"; then
    ok "Записи DNS-only (серое облако), отвечает напрямую GitHub Pages"
  else
    warn "Отвечает не GitHub и не Cloudflare, проверить вручную"
  fi
fi

echo
echo "== Сертификат =="
CERT=$(echo | openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" 2>/dev/null | openssl x509 -noout -subject -issuer -dates -ext subjectAltName 2>/dev/null)
if [ -z "$CERT" ]; then
  bad "Сертификат не получен вовсе"
else
  grep -q "urguteats.com" <<<"$CERT" && ok "Выдан на $DOMAIN" || bad "Сертификат выдан на другое имя"
  grep -q "www.$DOMAIN" <<<"$CERT" && ok "Покрывает www" || bad "www НЕ покрыт сертификатом"
  NOT_AFTER=$(sed -n 's/^notAfter=//p' <<<"$CERT")
  if [ -n "$NOT_AFTER" ]; then
    END=$(date -j -f "%b %d %T %Y %Z" "$NOT_AFTER" "+%s" 2>/dev/null || date -d "$NOT_AFTER" "+%s" 2>/dev/null)
    if [ -n "${END:-}" ]; then
      DAYS=$(( (END - $(date +%s)) / 86400 ))
      [ "$DAYS" -gt 14 ] && ok "Действует ещё $DAYS дн." || bad "Истекает через $DAYS дн."
    fi
  fi
fi

echo
echo "== Доступность (каждый IPv4-эндпоинт отдельно) =="
for ip in $EXPECTED_A; do
  CODE=$(curl -s -m 15 -o /dev/null -w "%{http_code}:%{ssl_verify_result}" --resolve "$DOMAIN:443:$ip" "https://$DOMAIN/" || echo "000:x")
  [ "$CODE" = "200:0" ] && ok "$ip отдаёт 200, TLS валиден" || bad "$ip вернул $CODE"
done

echo
echo "== Маршруты входа =="
for url in "http://$DOMAIN/" "http://www.$DOMAIN/" "https://www.$DOMAIN/"; do
  FINAL=$(curl -s -m 20 -o /dev/null -w "%{http_code} -> %{url_effective}" -L "$url" || echo "нет ответа")
  case "$FINAL" in 200*) ok "$url  ($FINAL)" ;; *) bad "$url  ($FINAL)" ;; esac
done

echo
echo "== Страницы =="
for p in "/" "/locations/afsona/" "/locations/osh-markazi/" "/locations/sariq-bola/"; do
  CODE=$(curl -s -m 20 -o /dev/null -w "%{http_code}" "https://$DOMAIN$p" || echo 000)
  [ "$CODE" = "200" ] && ok "$p" || bad "$p вернул $CODE"
done

echo
[ "$FAIL" -eq 0 ] && echo "ИТОГ: всё зелёное." || echo "ИТОГ: есть проблемы (см. FAIL выше)."
exit $FAIL
