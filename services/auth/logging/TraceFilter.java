package com.sitefrisk.auth.logging;

import java.io.IOException;
import java.security.SecureRandom;

import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Кладёт trace_id и span_id в MDC — оттуда Spring Boot сам переносит их
 * в JSON каждой записи лога.
 *
 * HIGHEST_PRECEDENCE: фильтр должен отработать до цепочки Spring Security,
 * иначе отказы авторизации окажутся без trace_id.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class TraceFilter extends OncePerRequestFilter {

    private static final String HEADER = "traceparent";
    private static final SecureRandom RANDOM = new SecureRandom();

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String traceId = traceIdFrom(request.getHeader(HEADER));
        String spanId = randomHex(8);

        MDC.put("trace_id", traceId);
        MDC.put("span_id", spanId);
        response.setHeader(HEADER, "00-" + traceId + "-" + spanId + "-01");

        try {
            chain.doFilter(request, response);
        } finally {
            // !!! MDC — это ThreadLocal, а Tomcat переиспользует
            // потоки из пула. Без очистки следующий запрос на этом потоке
            // унаследует trace_id предыдущего — и трассы перемешаются.
            MDC.clear();
        }
    }

    /** Валидный входящий trace-id сохраняем, иначе начинаем новую трассу. */
    private static String traceIdFrom(String header) {
        if (header == null) {
            return randomHex(16);
        }
        String[] parts = header.split("-");
        if (parts.length != 4
                || parts[0].length() != 2 || parts[1].length() != 32
                || parts[2].length() != 16 || parts[3].length() != 2
                || "ff".equals(parts[0])
                || !isLowerHex(parts[1]) || !isLowerHex(parts[2])
                || parts[1].chars().allMatch(c -> c == '0')) {
            return randomHex(16);
        }
        return parts[1];
    }

    private static boolean isLowerHex(String s) {
        return s.chars().allMatch(c -> (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'));
    }

    private static String randomHex(int bytes) {
        byte[] buf = new byte[bytes];
        RANDOM.nextBytes(buf);
        StringBuilder sb = new StringBuilder(bytes * 2);
        for (byte b : buf) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}