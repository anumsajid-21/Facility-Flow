param([string]$BaseUrl = 'http://localhost:3001')

function Login($email, $password) {
    $body = '{"email":"' + $email + '","password":"' + $password + '"}'
    $resp = Invoke-RestMethod -Uri "$BaseUrl/api/v1/auth/login" -Method Post -ContentType 'application/json' -Body $body
    return @{ Token = $resp.data.access_token; User = $resp.data.user }
}

function GetCount($uri, $token) {
    $h = @{ Authorization = "Bearer $token" }
    $r = Invoke-RestMethod -Uri $uri -Method Get -Headers $h
    if ($null -eq $r) { return 0 }
    # unwrap { data: [...] } wrappers
    $payload = if ($r.data -is [array])   { $r.data }
               elseif ($r.data -is [pscustomobject]) { $r.data }
               else                         { $r }
    if ($payload -is [array]) { return $payload.count }
    elseif ($payload -is [pscustomobject]) {
        # pagination meta has the real total
        if ($payload.total -ne $null)   { return $payload.total }
        if ($payload.items)             { return $payload.items.count }
        if ($payload.notifications)     { return $payload.notifications.count }
        if ($payload.threads)           { return $payload.threads.count }
        if ($payload.reviews)           { return $payload.reviews.count }
        if ($payload.data -is [array])  { return $payload.data.count }
        return 1
    }
    return 0
}

$org  = Login 'hiring@facilityflow.app'  'Hire@12345'
$prov = Login 'provider@facilityflow.app' 'Provide@12345'
$admin = Login 'admin@facilityflow.app'   'Admin@12345'

echo '=== SEED DATA COUNTS (full, via pagination meta) ==='
echo "JOBS (org):              $(GetCount "$BaseUrl/api/v1/jobs" $org.Token)"
echo "INVOICES (org):          $(GetCount "$BaseUrl/api/v1/invoices" $org.Token)"
echo "CONTRACTS (org):         $(GetCount "$BaseUrl/api/v1/contracts" $org.Token)"
echo "REVIEWS_MINE (org):      $(GetCount "$BaseUrl/api/v1/reviews" $org.Token)"
echo "NOTIFICATIONS (org):     $(GetCount "$BaseUrl/api/v1/notifications" $org.Token)"
echo "MESSAGE_THREADS (org):   $(GetCount "$BaseUrl/api/v1/messages/threads" $org.Token)"
echo "SLA_POLICIES (provider): $(GetCount "$BaseUrl/api/v1/sla/policies" $prov.Token)"
echo "PROVIDER_REVIEWS (prov): $(GetCount "$BaseUrl/api/v1/reviews/provider/$($prov.User.providerId)" $prov.Token)"
echo "ANALYTICS (org):         $(GetCount "$BaseUrl/api/v1/analytics" $org.Token)"
echo '=== DONE ==='
