package com.sitefrisk.auth.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

    // Заглушка: пропускаем /actuator/health без авторизации,
    // всё остальное пока требует базовой аутентификации.
    // TODO: заменить httpBasic на выпуск/проверку JWT (RBAC).
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/health").permitAll()
                .anyRequest().authenticated()
            )
            .httpBasic(basic -> {});

        return http.build();
    }
}