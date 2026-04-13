
BASE_URL="http://localhost:5000"


LOG_FILE="./scripts/warm-cache.log"


TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

echo "─────────────────────────────────────────────" | tee -a $LOG_FILE
echo "Cache Warming Started: $TIMESTAMP" | tee -a $LOG_FILE
echo "─────────────────────────────────────────────" | tee -a $LOG_FILE


echo "Checking server health..." | tee -a $LOG_FILE

HEALTH=$(curl -s "$BASE_URL/api/health")

if [ -z "$HEALTH" ]; then
  echo "ERROR: Server is not running. Exiting." | tee -a $LOG_FILE
  exit 1
fi

echo "Server is running ✓" | tee -a $LOG_FILE


echo "Clearing old cache..." | tee -a $LOG_FILE

CLEAR=$(curl -s -X DELETE "$BASE_URL/api/products/cache/all")
echo "Cache cleared: $CLEAR" | tee -a $LOG_FILE


sleep 1


echo "Warming all products cache..." | tee -a $LOG_FILE

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}\nTIME:%{time_total}s" "$BASE_URL/api/products")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
TIME=$(echo "$RESPONSE" | grep "TIME" | cut -d: -f2)

if [ "$HTTP_STATUS" = "200" ]; then
  echo "All products warmed ✓ | Status: $HTTP_STATUS | Time: $TIME" | tee -a $LOG_FILE
else
  echo "WARNING: All products returned status $HTTP_STATUS" | tee -a $LOG_FILE
fi


sleep 1


echo "Warming individual product caches..." | tee -a $LOG_FILE


PRODUCTS_JSON=$(curl -s "$BASE_URL/api/products")


IDS=$(echo $PRODUCTS_JSON | grep -o '"_id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$IDS" ]; then
  echo "WARNING: No product IDs found" | tee -a $LOG_FILE
else
  for ID in $IDS; do
    PROD_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}\nTIME:%{time_total}s" "$BASE_URL/api/products/$ID")

    PROD_STATUS=$(echo "$PROD_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
    PROD_TIME=$(echo "$PROD_RESPONSE" | grep "TIME" | cut -d: -f2)

    if [ "$PROD_STATUS" = "200" ]; then
      echo "Product $ID warmed ✓ | Status: $PROD_STATUS | Time: $PROD_TIME" | tee -a $LOG_FILE
    else
      echo "WARNING: Product $ID returned status $PROD_STATUS" | tee -a $LOG_FILE
    fi

    sleep 0.5
  done
fi

echo "Verifying cache is warm..." | tee -a $LOG_FILE

VERIFY=$(curl -s "$BASE_URL/api/products")
FROM_CACHE=$(echo $VERIFY | grep -o '"fromCache":[a-z]*' | cut -d: -f2)

if [ "$FROM_CACHE" = "true" ]; then
  echo "Cache verified as WARM ✓" | tee -a $LOG_FILE
else
  echo "Cache verification: data served fresh from DB" | tee -a $LOG_FILE
fi

END_TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
echo "─────────────────────────────────────────────" | tee -a $LOG_FILE
echo "Cache Warming Finished: $END_TIMESTAMP" | tee -a $LOG_FILE
echo "─────────────────────────────────────────────" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE