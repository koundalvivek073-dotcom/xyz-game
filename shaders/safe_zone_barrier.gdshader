shader_type spatial;
render_mode blend_add, depth_draw_never, cull_disabled;

uniform vec4 zone_color : source_color = vec4(0.0, 0.75, 1.0, 1.0);
uniform float pulse_speed : hint_range(0.1, 5.0) = 1.4;
uniform float scanline_frequency : hint_range(1.0, 50.0) = 18.0;
uniform float edge_fresnel_power : hint_range(0.5, 6.0) = 2.4;
uniform float base_alpha : hint_range(0.05, 0.8) = 0.22;

void fragment() {
    // Height & Time based scanlines
    float scanline = sin(VERTEX.y * scanline_frequency - TIME * pulse_speed * 4.0) * 0.5 + 0.5;
    
    // Fresnel rim effect
    float fresnel = 1.0 - clamp(dot(normalize(NORMAL), normalize(VIEW)), 0.0, 1.0);
    fresnel = pow(fresnel, edge_fresnel_power);
    
    // Pulse intensity
    float pulse = sin(TIME * pulse_speed) * 0.15 + 0.85;
    
    ALBEDO = zone_color.rgb;
    EMISSION = zone_color.rgb * (fresnel * 2.5 + scanline * 0.6) * pulse;
    ALPHA = clamp(base_alpha + fresnel * 0.75 + scanline * 0.15, 0.0, 1.0);
}
