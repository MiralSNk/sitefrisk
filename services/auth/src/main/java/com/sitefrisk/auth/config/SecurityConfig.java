package com.sitefrisk.auth.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

    // Заглушка до появления JWT: открыт только healthcheck,
    // всё остальное закрыто наглухо. Basic-аутентификации нет —
    // логиниться пока некуда и некому.
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/health").permitAll()
                .anyRequest().denyAll()
            )
            .httpBasic(AbstractHttpConfigurer::disable)
            .formLogin(AbstractHttpConfigurer::disable);

        return http.build();
    }

    // Пустое хранилище пользователей.
    //
    // Нужно не для работы, а чтобы ОТКЛЮЧИТЬ автоконфигурацию
    // UserDetailsServiceAutoConfiguration: она включается только когда
    // бина UserDetailsService нет, и печатает в лог сгенерированный
    // пароль. Свой бин заставляет её отступить.
    @Bean
    public UserDetailsService userDetailsService() {
        return username -> {
            throw new UsernameNotFoundException(username);
        };
    }
}